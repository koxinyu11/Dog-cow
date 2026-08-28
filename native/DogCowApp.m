#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <Security/Security.h>

static NSString *const DogCowRepository = @"koxinyu11/Dog-cow";
static NSString *const DogCowKeychainService = @"app.dogcow.updater";

@interface DogCowAppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) WKWebView *webView;
@end

@implementation DogCowAppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    configuration.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
    [configuration.userContentController addScriptMessageHandler:self name:@"dogCowUpdater"];
    self.webView = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
    self.webView.navigationDelegate = self;

    NSWindowStyleMask style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable |
        NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable | NSWindowStyleMaskFullSizeContentView;
    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 1280, 820)
                                              styleMask:style backing:NSBackingStoreBuffered defer:NO];
    self.window.title = @"狗牛";
    self.window.titlebarAppearsTransparent = YES;
    self.window.titleVisibility = NSWindowTitleHidden;
    self.window.minSize = NSMakeSize(900, 620);
    self.window.releasedWhenClosed = NO;
    [self.window setFrameAutosaveName:@"DogCowMainWindow"];
    self.window.contentView = self.webView;
    [self.window center];

    NSURL *resourceURL = NSBundle.mainBundle.resourceURL;
    NSURL *indexURL = [resourceURL URLByAppendingPathComponent:@"index.html"];
    if (!resourceURL || ![[NSFileManager defaultManager] fileExistsAtPath:indexURL.path]) {
        [self showAlert:@"狗牛无法打开" detail:@"找不到应用资源。"];
        [NSApp terminate:nil];
        return;
    }
    [self.webView loadFileURL:indexURL allowingReadAccessToURL:resourceURL];
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
    if ([self savedToken]) [self checkForUpdatesPrompting:NO];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender { return YES; }
- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender hasVisibleWindows:(BOOL)flag {
    if (!flag) [self.window makeKeyAndOrderFront:nil];
    return YES;
}
- (BOOL)applicationSupportsSecureRestorableState:(NSApplication *)app { return YES; }

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    if ([message.name isEqualToString:@"dogCowUpdater"]) [self checkForUpdatesPrompting:YES];
}

- (NSString *)savedToken {
    NSDictionary *query = @{(__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
                            (__bridge id)kSecAttrService: DogCowKeychainService,
                            (__bridge id)kSecAttrAccount: @"github-token",
                            (__bridge id)kSecReturnData: @YES,
                            (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitOne};
    CFTypeRef result = NULL;
    if (SecItemCopyMatching((__bridge CFDictionaryRef)query, &result) != errSecSuccess) return nil;
    NSData *data = CFBridgingRelease(result);
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

- (void)saveToken:(NSString *)token {
    NSDictionary *key = @{(__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
                          (__bridge id)kSecAttrService: DogCowKeychainService,
                          (__bridge id)kSecAttrAccount: @"github-token"};
    SecItemDelete((__bridge CFDictionaryRef)key);
    NSMutableDictionary *item = [key mutableCopy];
    item[(__bridge id)kSecValueData] = [token dataUsingEncoding:NSUTF8StringEncoding];
    SecItemAdd((__bridge CFDictionaryRef)item, NULL);
}

- (NSString *)requestToken {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"连接私人更新仓库";
    alert.informativeText = @"请输入仅对 Dog-cow 仓库具有 Contents 只读权限的 GitHub fine-grained token。令牌只保存在本机钥匙串。";
    NSSecureTextField *field = [[NSSecureTextField alloc] initWithFrame:NSMakeRect(0, 0, 420, 24)];
    field.placeholderString = @"github_pat_…";
    alert.accessoryView = field;
    [alert addButtonWithTitle:@"保存并检查"];
    [alert addButtonWithTitle:@"取消"];
    if ([alert runModal] != NSAlertFirstButtonReturn) return nil;
    NSString *token = [field.stringValue stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if (token.length) [self saveToken:token];
    return token.length ? token : nil;
}

- (NSMutableURLRequest *)requestForURL:(NSURL *)url token:(NSString *)token accept:(NSString *)accept {
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    [request setValue:(accept ?: @"application/vnd.github+json") forHTTPHeaderField:@"Accept"];
    [request setValue:@"2022-11-28" forHTTPHeaderField:@"X-GitHub-Api-Version"];
    [request setValue:@"DogCow-Updater" forHTTPHeaderField:@"User-Agent"];
    [request setValue:[@"Bearer " stringByAppendingString:token] forHTTPHeaderField:@"Authorization"];
    return request;
}

- (void)checkForUpdatesPrompting:(BOOL)prompt {
    NSString *token = [self savedToken];
    if (!token && prompt) token = [self requestToken];
    if (!token) return;
    NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"https://api.github.com/repos/%@/releases/latest", DogCowRepository]];
    [[[NSURLSession sharedSession] dataTaskWithRequest:[self requestForURL:url token:token accept:nil]
                                     completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        NSHTTPURLResponse *http = (NSHTTPURLResponse *)response;
        if (error || http.statusCode != 200) {
            if (prompt) dispatch_async(dispatch_get_main_queue(), ^{ [self showAlert:@"无法检查更新" detail:@"请确认网络、仓库访问权限和 GitHub token 是否有效。"] ;});
            return;
        }
        NSDictionary *release = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        NSString *tag = [release[@"tag_name"] stringByReplacingOccurrencesOfString:@"v" withString:@""];
        NSString *current = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"0";
        if (!tag.length || [tag compare:current options:NSNumericSearch] != NSOrderedDescending) {
            if (prompt) dispatch_async(dispatch_get_main_queue(), ^{ [self showAlert:@"已经是最新版本" detail:[NSString stringWithFormat:@"当前版本 %@。", current]]; });
            return;
        }
        NSDictionary *asset = nil;
        for (NSDictionary *candidate in release[@"assets"]) {
            if ([candidate[@"name"] hasSuffix:@"Mac安装包.zip"]) { asset = candidate; break; }
        }
        if (!asset[@"url"]) {
            dispatch_async(dispatch_get_main_queue(), ^{ [self showAlert:@"发现新版本" detail:@"Release 中暂时没有 Mac 安装包。"] ;});
            return;
        }
        [self offerDownload:asset version:tag token:token];
    }] resume];
}

- (void)offerDownload:(NSDictionary *)asset version:(NSString *)version token:(NSString *)token {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSAlert *alert = [[NSAlert alloc] init];
        alert.messageText = [NSString stringWithFormat:@"发现新版本 %@", version];
        alert.informativeText = @"是否下载更新安装包？下载后请解压并用新版“狗牛.app”替换旧版。";
        [alert addButtonWithTitle:@"下载更新"];
        [alert addButtonWithTitle:@"稍后"];
        if ([alert runModal] != NSAlertFirstButtonReturn) return;
        NSURL *url = [NSURL URLWithString:asset[@"url"]];
        [[[NSURLSession sharedSession] dataTaskWithRequest:[self requestForURL:url token:token accept:@"application/octet-stream"]
                                         completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            NSHTTPURLResponse *http = (NSHTTPURLResponse *)response;
            if (error || http.statusCode < 200 || http.statusCode >= 300 || !data.length) {
                dispatch_async(dispatch_get_main_queue(), ^{ [self showAlert:@"下载失败" detail:@"请稍后重试。"] ;});
                return;
            }
            NSURL *downloads = [NSFileManager.defaultManager URLsForDirectory:NSDownloadsDirectory inDomains:NSUserDomainMask].firstObject;
            NSURL *target = [downloads URLByAppendingPathComponent:[NSString stringWithFormat:@"狗牛-v%@-Mac安装包.zip", version]];
            [data writeToURL:target atomically:YES];
            dispatch_async(dispatch_get_main_queue(), ^{
                [NSWorkspace.sharedWorkspace activateFileViewerSelectingURLs:@[target]];
                [self showAlert:@"更新已下载" detail:@"已在“下载”文件夹中显示安装包。退出狗牛后，解压并替换旧版即可。"];
            });
        }] resume];
    });
}

- (void)showAlert:(NSString *)title detail:(NSString *)detail {
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = title;
    alert.informativeText = detail;
    [alert runModal];
}

- (void)dealloc {
    [self.webView.configuration.userContentController removeScriptMessageHandlerForName:@"dogCowUpdater"];
}
@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = NSApplication.sharedApplication;
        DogCowAppDelegate *delegate = [[DogCowAppDelegate alloc] init];
        [application setActivationPolicy:NSApplicationActivationPolicyRegular];
        application.delegate = delegate;
        [application run];
    }
    return 0;
}
