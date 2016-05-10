//
//  JsBridgeHelper.h
//  GetGems
//
//  Created by Tal Kol on 3/15/15.
//
//

#import <Foundation/Foundation.h>
#import "UIWebView+JavaScriptAlert.h"

@interface JsBridgeHelper : NSObject <UIWebViewDelegate>

+ (JsBridgeHelper*)sharedInstance;
- (void)executeJsFunction:(NSString*)funcName withArg:(NSString*)arg callback:(void (^)(NSString*))block;

@end
