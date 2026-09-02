#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <Sparkle/Sparkle.h>

@interface DogCowAppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler>
@property(nonatomic, strong) NSWindow *window;
@property(nonatomic, strong) WKWebView *webView;
@property(nonatomic, strong) SPUStandardUpdaterController *updaterController;
@property(nonatomic, strong) NSTitlebarAccessoryViewController *compactAccessoryController;
@property(nonatomic, strong) NSButton *compactButton;
@property(nonatomic) NSRect expandedFrame;
@property(nonatomic) BOOL compactMode;
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
    [self installCompactButton];

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

- (void)installCompactButton {
    NSView *container = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, 38, 28)];
    self.compactButton = [[NSButton alloc] initWithFrame:NSMakeRect(5, 3, 28, 22)];
    self.compactButton.bezelStyle = NSBezelStyleTexturedRounded;
    self.compactButton.bordered = NO;
    self.compactButton.target = self;
    self.compactButton.action = @selector(toggleCompactMode:);
    self.compactButton.toolTip = @"缩成条状";
    self.compactButton.image = [NSImage imageWithSystemSymbolName:@"rectangle.compress.vertical"
                                        accessibilityDescription:@"缩成条状"];
    self.compactButton.imagePosition = NSImageOnly;
    [container addSubview:self.compactButton];

    self.compactAccessoryController = [[NSTitlebarAccessoryViewController alloc] init];
    self.compactAccessoryController.view = container;
    self.compactAccessoryController.layoutAttribute = NSLayoutAttributeRight;
    [self.window addTitlebarAccessoryViewController:self.compactAccessoryController];
}

- (void)toggleCompactMode:(id)sender {
    if (!self.compactMode) {
        self.expandedFrame = self.window.frame;
        CGFloat titlebarHeight = NSHeight(self.window.frame) - NSHeight(self.window.contentLayoutRect);
        CGFloat compactHeight = MAX(36.0, titlebarHeight);
        NSRect compactFrame = self.window.frame;
        compactFrame.origin.y = NSMaxY(compactFrame) - compactHeight;
        compactFrame.size.height = compactHeight;

        self.compactMode = YES;
        self.webView.hidden = YES;
        self.window.titleVisibility = NSWindowTitleVisible;
        self.window.styleMask &= ~NSWindowStyleMaskResizable;
        self.window.minSize = NSMakeSize(320, compactHeight);
        self.compactButton.image = [NSImage imageWithSystemSymbolName:@"rectangle.expand.vertical"
                                            accessibilityDescription:@"展开狗牛"];
        self.compactButton.toolTip = @"展开狗牛";
        [self.window setFrame:compactFrame display:YES animate:YES];
    } else {
        self.compactMode = NO;
        self.window.styleMask |= NSWindowStyleMaskResizable;
        self.window.minSize = NSMakeSize(900, 620);
        self.window.titleVisibility = NSWindowTitleHidden;
        self.webView.hidden = NO;
        self.compactButton.image = [NSImage imageWithSystemSymbolName:@"rectangle.compress.vertical"
                                            accessibilityDescription:@"缩成条状"];
        self.compactButton.toolTip = @"缩成条状";
        [self.window setFrame:self.expandedFrame display:YES animate:YES];
    }
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
