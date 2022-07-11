import {AnyToPromiseStatus, catchAsyncError, isFunction, isStream} from "@tsed/core";
import {Inject, Injectable, InjectorService, Provider, ProviderScope} from "@tsed/di";
import {$log} from "@tsed/logger";
import {ArgScope, PlatformParams} from "@tsed/platform-params";
import {PlatformResponseFilter} from "@tsed/platform-response-filter";
import {EndpointMetadata} from "@tsed/schema";
import {promisify} from "util";
import {AnyToPromiseWithCtx} from "../domain/AnyToPromiseWithCtx";
import {HandlerMetadata} from "../domain/HandlerMetadata";
import {PlatformContext} from "../domain/PlatformContext";
import {HandlerType} from "../interfaces/HandlerType";
import {PlatformRouteWithoutHandlers} from "../interfaces/PlatformRouteOptions";
import {createHandlerMetadata} from "../utils/createHandlerMetadata";
import {ensureContext} from "../utils/ensureContext";
import {setResponseHeaders} from "../utils/setResponseHeaders";

/**
 * Platform Handler abstraction layer. Wrap original class method to a pure platform handler (Express, Koa, etc...).
 * @platform
 */
@Injectable({
  scope: ProviderScope.SINGLETON
})
export class PlatformHandler {
  @Inject()
  protected responseFilter: PlatformResponseFilter;

  constructor(protected injector: InjectorService, protected params: PlatformParams) {}

  /**
   * Create a native middleware based on the given metadata and return an instance of AnyToPromiseWithCtx
   * @param input
   * @param options
   */
  createHandler(input: EndpointMetadata | HandlerMetadata | any, options: PlatformRouteWithoutHandlers = {}) {
    return this.createNativeHandler(createHandlerMetadata(this.injector, input, options));
  }

  /**
   * Create injectable handler from the given provider
   * @param provider
   * @param propertyKey
   */
  createCustomHandler(provider: Provider, propertyKey: string) {
    return this.compileHandler(
      new HandlerMetadata({
        token: provider.provide,
        target: provider.useClass,
        type: HandlerType.CUSTOM,
        scope: provider.scope,
        propertyKey
      })
    );
  }

  /**
   * Send the response to the consumer.
   * @protected
   * @param $ctx
   */
  async flush($ctx: PlatformContext) {
    const {response} = $ctx;

    if (!response.isDone()) {
      let data = await this.responseFilter.serialize($ctx.data, $ctx);
      data = await this.responseFilter.transform(data, $ctx);
      response.body(data);
    }

    return response;
  }

  public setResponseHeaders($ctx: PlatformContext) {
    if (!$ctx.response.isDone()) {
      return setResponseHeaders($ctx);
    }
  }

  protected compileHandler(metadata: HandlerMetadata): ($ctx: PlatformContext) => Promise<void> {
    if (metadata.type === HandlerType.CTX_FN) {
      return async ($ctx) => {
        $ctx.handlerMetadata = metadata;

        try {
          return await $ctx.handlerMetadata.handler($ctx);
        } catch (error) {
          return this.onError(error, $ctx);
        }
      };
    }

    const promise = this.params.compileHandler<PlatformContext>({
      token: metadata.token,
      propertyKey: metadata.propertyKey,
      getCustomArgs: metadata.injectable ? undefined : this.getDefaultArgs(metadata)
    });

    return async ($ctx: PlatformContext) => {
      $ctx.handlerMetadata = metadata;

      return this.onRequest(await promise, $ctx);
    };
  }

  /**
   * Create a native handler for a compatible express framework
   * @param metadata
   */
  protected createNativeHandler(metadata: HandlerMetadata) {
    if (metadata.isRawMiddleware()) {
      return metadata.handler;
    }

    const handler = this.compileHandler(metadata);

    // Express style handler
    const cb = async (request: any, response: any, next: any, err?: unknown) =>
      ensureContext(request, async ($ctx) => {
        $ctx && ($ctx.error = err);
        const error = await catchAsyncError(() => handler($ctx));

        return this.next(error, next, $ctx);
      });

    if (metadata.isErrorMiddleware()) {
      // Express error style handler
      return async (err: unknown, req: any, res: any, next: any) => cb(req, res, next, err);
    }

    return (request: any, response: any, next: any) => cb(request, response, next);
  }

  protected next(error: unknown, next: any, $ctx: PlatformContext) {
    if (isStream($ctx.data) || $ctx.isDone()) {
      return;
    }

    return error ? next(error) : next();
  }

  /**
   * Call handler when a request his handle
   */
  protected async onRequest(handler: (scope: ArgScope) => any, $ctx: PlatformContext): Promise<any> {
    // istanbul ignore next
    if ($ctx.isDone()) {
      $log.error({
        name: "HEADERS_SENT",
        message: `An endpoint is called but the response is already send to the client. The call comes from the handler: ${$ctx.handlerMetadata.toString()}`
      });
      return;
    }

    const resolver = new AnyToPromiseWithCtx($ctx);

    try {
      const {state, data, status, headers} = await resolver.call(handler);

      if (state === AnyToPromiseStatus.RESOLVED) {
        if (status) {
          $ctx.response.status(status);
        }

        if (headers) {
          $ctx.response.setHeaders(headers);
        }

        if (data !== undefined) {
          $ctx.data = data;
        }

        // Can be canceled by the handler itself
        return await this.onSuccess($ctx);
      }
    } catch (error) {
      return this.onError(error, $ctx);
    }
  }

  protected async onError(error: unknown, $ctx: PlatformContext) {
    $ctx.error = error;

    throw error;
  }

  /**
   * Manage success scenario
   * @param $ctx
   * @protected
   */
  protected async onSuccess($ctx: PlatformContext) {
    // istanbul ignore next
    if ($ctx.isDone()) {
      return;
    }

    $ctx.error = null;

    const metadata = $ctx.handlerMetadata;

    // set headers each times that an endpoint is called

    if (metadata.isEndpoint()) {
      this.setResponseHeaders($ctx);
    }

    // call returned middleware
    if (isFunction($ctx.data) && !isStream($ctx.data)) {
      return promisify($ctx.data)($ctx.getRequest(), $ctx.getResponse());
    }

    if (metadata.isFinal()) {
      return this.flush($ctx);
    }
  }

  /**
   * @deprecated
   */
  protected getDefaultArgs(metadata: HandlerMetadata) {
    return async (scope: ArgScope<PlatformContext>) =>
      [
        metadata.hasErrorParam && scope.$ctx.error,
        scope.$ctx.request.request,
        scope.$ctx.response.response,
        metadata.hasNextFunction && scope.next
      ].filter(Boolean);
  }
}
