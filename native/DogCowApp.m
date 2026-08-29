#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <Sparkle/Sparkle.h>

@interface DogCowAppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, strong) SPUStandardUpdaterController *updaterController;
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
    self.updaterController = [[SPUStandardUpdaterController alloc] initWithUpdaterDelegate:nil userDriverDelegate:nil];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender { return YES; }
- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender hasVisibleWindows:(BOOL)flag {
    if (!flag) [self.window makeKeyAndOrderFront:nil];
    return YES;
}
- (BOOL)applicationSupportsSecureRestorableState:(NSApplication *)app { return YES; }

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    if (![message.name isEqualToString:@"dogCowUpdater"]) return;
    [self.updaterController checkForUpdates:nil];
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
