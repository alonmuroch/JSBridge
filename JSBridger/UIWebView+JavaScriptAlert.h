//
//  UIWebView+JavaScriptAlert.h
//  GetGems
//
//  Created by Tal Kol on 3/15/15.
//
//

#import <UIKit/UIKit.h>

@interface UIWebView (JavaScriptAlert)

- (void)webView:(UIWebView *)sender runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(id)frame;

@end
