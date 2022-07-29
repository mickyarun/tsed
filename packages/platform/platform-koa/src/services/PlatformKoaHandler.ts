import {PlatformContext, PlatformHandler} from "@tsed/common";
import "./PlatformKoaRequest";

export class PlatformKoaHandler extends PlatformHandler {
  public async flush($ctx: PlatformContext) {
    if ($ctx.error) {
      this.platformExceptions.catch($ctx.error, $ctx);
      return;
    }

    if ($ctx.data === undefined && $ctx.getResponse().body) {
      $ctx.data = $ctx.getResponse().body;
    }

    return super.flush($ctx);
  }
}
