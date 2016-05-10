//
//  JsBridgeHelper.m
//  GetGems
//
//  Created by Tal Kol on 3/15/15.
//
//

#import "JsBridgeHelper.h"

@interface JsBridgeHelper ()

@property (nonatomic, strong) UIWebView *webView;
@property (nonatomic, strong) NSMutableDictionary *activeCalls;

@end


@implementation JsBridgeHelper

// singleton
+ (JsBridgeHelper*)sharedInstance
{
    static JsBridgeHelper *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[JsBridgeHelper alloc] init];
        [sharedInstance setup];
    });
    return sharedInstance;
}

- (void)setup
{
    self.activeCalls = [NSMutableDictionary dictionary];
    self.webView = [[UIWebView alloc] initWithFrame:CGRectMake(0, 0, 1024,768)];
    self.webView.delegate = self;
    
    NSURL *url = [[NSBundle mainBundle] URLForResource:@"ExampleApp" withExtension:@"html"];
    // NSLog(@"JsBridge: index.html = %@", [NSString stringWithContentsOfURL:url encoding:NSUTF8StringEncoding error:nil]);
    [self.webView loadRequest:[NSURLRequest requestWithURL:url]];
}

- (BOOL)webView:(UIWebView *)webView shouldStartLoadWithRequest:(NSURLRequest *)request navigationType:(UIWebViewNavigationType)navigationType
{
    #pragma unused (navigationType)
    if (webView != self.webView) return YES;
    NSURL *URL = [request URL];
    
    NSLog(@"JsBridge: shouldStartLoadWithRequest %@", [URL absoluteString]);
    if ([[URL scheme] isEqualToString:@"bridge"])
    {
        NSString *callId = [URL host];
        NSString *res = [URL query];
        res = [res stringByReplacingOccurrencesOfString:@"+" withString:@" "];
        res = [res stringByReplacingPercentEscapesUsingEncoding:NSUTF8StringEncoding]; 
        [self jsFunctionReturned:callId withRes:res];
        return NO;
    }
    else
         NSLog(@"JsBridge: setup complete");
    
    return YES;
}

- (void)executeJsFunction:(NSString*)funcName withArg:(NSString*)arg callback:(void (^)(NSString*))block
{
    NSString *callId = [@(arc4random()) stringValue];
    [self.activeCalls setObject:block forKey:callId];
    NSString *jsCode = [NSString stringWithFormat:@"iosBridge.nativeToJs('%@','%@','%@')", callId, funcName, arg];
     NSLog(@"JsBridge: executeJsFunction %@", jsCode);
    [self.webView stringByEvaluatingJavaScriptFromString:jsCode];
}

- (void)jsFunctionReturned:(NSString*)callId withRes:(NSString*)res
{
    if (!callId) return;
    id blockObj = [self.activeCalls objectForKey:callId];
    if (!blockObj) return;
    [self.activeCalls removeObjectForKey:callId];
    void (^block)(NSString*) = (void (^)(NSString*))blockObj;
    block(res);
}

@end
