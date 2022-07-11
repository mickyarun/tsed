import {ArgScope, getContext, HandlerMetadata, HandlerType, PlatformContext, PlatformHandler} from "@tsed/common";
import {catchAsyncError, isStream} from "@tsed/core";
import Koa from "koa";
import "./PlatformKoaRequest";

const OVERRIDE_TYPES = [HandlerType.ENDPOINT, HandlerType.MIDDLEWARE, HandlerType.ERR_MIDDLEWARE, HandlerType.CTX_FN];

export class PlatformKoaHandler extends PlatformHandler {
  public async flush($ctx: PlatformContext) {
    if ($ctx.data === undefined && $ctx.getResponse().body) {
      $ctx.data = $ctx.getResponse().body;
    }

    return super.flush($ctx);
  }

  protected createNativeHandler(metadata: HandlerMetadata) {
    if (OVERRIDE_TYPES.includes(metadata.type)) {
      const handler = this.compileHandler(metadata);

      return async (ctx: Koa.Context, next: Koa.Next) => {
        const $ctx = getContext<PlatformContext>();

        if ($ctx) {
          const error = await catchAsyncError(() => handler($ctx));

          return this.next(error, next, $ctx);
        }
      };
    }

    return super.createNativeHandler(metadata);
  }

  protected async onRequest(handler: (scope: ArgScope) => any, $ctx: PlatformContext): Promise<any> {
    if ($ctx.error instanceof Error && !$ctx.handlerMetadata.hasErrorParam) {
      return;
    }

    return super.onRequest(handler, $ctx);
  }

  protected next(error: unknown, next: any, $ctx: PlatformContext) {
    if (isStream($ctx.data) || $ctx.isDone()) {
      return;
    }

    if (error && !($ctx.handlerMetadata.isEndpoint() && !$ctx.handlerMetadata.isFinal())) {
      $ctx.getApp().emit("error", error, $ctx.getRequest().ctx);
      return;
    }

    return !$ctx.handlerMetadata.isFinal() && next();
  }
}
