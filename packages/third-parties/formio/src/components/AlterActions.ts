import {AnyToPromiseWithCtx, ArgScope, getContext, PlatformContext, PlatformHandler} from "@tsed/common";
import {AnyToPromiseStatus, catchAsyncError} from "@tsed/core";
import {Inject, InjectorService, Provider} from "@tsed/di";
import {FormioActionInfo} from "@tsed/formio-types";
import {PlatformParams} from "@tsed/platform-params";
import {PlatformResponseFilter} from "@tsed/platform-response-filter";
import {EndpointMetadata} from "@tsed/schema";
import {Alter} from "../decorators/alter";
import {AlterHook} from "../domain/AlterHook";
import {SetActionItemMessage} from "../domain/FormioAction";
import {FormioActions} from "../domain/FormioActionsIndex";
import {FormioService} from "../services/FormioService";

@Alter("actions")
export class AlterActions implements AlterHook {
  @Inject()
  protected injector: InjectorService;

  @Inject()
  protected formio: FormioService;

  @Inject()
  protected params: PlatformParams;

  @Inject()
  protected handlers: PlatformHandler;

  @Inject()
  protected responseFilter: PlatformResponseFilter;

  transform(actions: FormioActions): FormioActions {
    const {Action} = this.formio;

    return this.getActions().reduce((actions, provider) => {
      const instance = this.injector.invoke<any>(provider.token);
      const options = provider.store.get<FormioActionInfo>("formio:action");
      const resolveHandler = this.createHandler(provider, "resolve");

      return {
        ...actions,
        [options.name]: class extends Action {
          static access = options.access;

          static async info(req: any, res: any, next: Function) {
            let opts = {...options};

            if (instance.info) {
              opts = await instance.info(opts, req, res);
            }

            next(null, opts);
          }

          static async settingsForm(req: any, res: any, next: Function) {
            next(null, await instance.settingsForm(req, res));
          }

          resolve(handler: string, method: string, req: any, res: any, next: Function, setActionItemMessage: SetActionItemMessage): void {
            resolveHandler(this, handler, method, req, res, next, setActionItemMessage);
          }
        }
      };
    }, actions);
  }

  protected getActions() {
    return this.injector.getProviders("formio:action");
  }

  protected createHandler(provider: Provider, propertyKey: string | symbol) {
    const promisedHandler = this.params.compileHandler({
      token: provider.token,
      propertyKey
    });

    return async (
      action: any,
      handler: string,
      method: string,
      req: {$ctx: PlatformContext},
      res: any,
      next: any,
      setActionItemMessage: SetActionItemMessage
    ) => {
      const $ctx = getContext<PlatformContext>()!;

      const error = await catchAsyncError(async () => {
        $ctx.set("ACTION_CTX", {handler, method, setActionItemMessage, action});
        $ctx.endpoint = EndpointMetadata.get(provider.useClass, "resolve");

        return this.onRequest(await promisedHandler, $ctx);
      });

      return (error || $ctx.data === undefined) && next(error);
    };
  }

  private async onRequest(handler: (scope: ArgScope) => any, $ctx: PlatformContext) {
    const resolver = new AnyToPromiseWithCtx($ctx);

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
        this.handlers.setResponseHeaders($ctx);
        return this.handlers.flush($ctx);
      }
    }
  }
}
