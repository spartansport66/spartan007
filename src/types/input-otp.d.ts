declare module "input-otp" {
  import * as React from "react";

  interface OTPInputContextValue {
    char: string;
    hasFakeCaret: boolean;
    isActive: boolean;
    slots: { char: string; hasFakeCaret: boolean; isActive: boolean }[];
  }

  export const OTPInput: React.FC<any>; // Consider replacing 'any' with more specific props if available
  export const OTPInputContext: React.Context<OTPInputContextValue>;
}