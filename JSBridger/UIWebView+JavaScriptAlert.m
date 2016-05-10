//
//  UIWebView+JavaScriptAlert.m
//  GetGems
//
//  Created by Tal Kol on 3/15/15.
//
//

#import "UIWebView+JavaScriptAlert.h"

@implementation UIWebView (JavaScriptAlert)

- (void)webView:(UIWebView *)sender runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(id)frame
{
    #pragma unused (sender)
    #pragma unused (frame)
    NSLog(@"JsBridge DEBUG:\n%@", message);
}


@end
