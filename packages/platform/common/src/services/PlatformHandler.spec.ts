import {
  Context,
  Controller,
  EndpointMetadata,
  Err,
  Get,
  HandlerMetadata,
  HandlerType,
  Injectable,
  Middleware,
  PlatformTest,
  QueryParams
} from "@tsed/common";
import {catchAsyncError} from "@tsed/core";
import {Forbidden} from "@tsed/exceptions";
import {ContentType, Returns} from "@tsed/schema";
import {createReadStream} from "fs";
import {join} from "path";
import {invokePlatformHandler} from "../../../../../test/helper/invokePlatformHandler";
import {PlatformHandler} from "./PlatformHandler";

class Test {
  @Get("/")
  get(@QueryParams("test") v: string) {
    return v;
  }

  use(@Err() error: any) {
    return error;
  }

  useErr(err: any, req: any, res: any, next: any) {}
}

class CustomPlatformHandler extends PlatformHandler {}

describe("PlatformHandler", () => {
  beforeEach(PlatformTest.create);
  beforeEach(() => {
    PlatformTest.injector.getProvider(PlatformHandler)!.useClass = CustomPlatformHandler;
  });
  afterEach(PlatformTest.reset);
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("createCustomHandler()", () => {
    it("should return a custom handler", async () => {
      const platformHandler = await invokePlatformHandler<PlatformHandler>(PlatformHandler);

      @Injectable()
      class Test {
        get(@Context() $ctx: any) {
          return "hello";
        }
      }

      PlatformTest.invoke(Test);
      const $ctx = PlatformTest.createRequestContext();

      const handler = platformHandler.createCustomHandler(PlatformTest.injector.getProvider(Test)!, "get");

      await handler($ctx);

      expect($ctx.data).toEqual("hello");
    });
    it("should catch error", async () => {
      const platformHandler = await invokePlatformHandler<PlatformHandler>(PlatformHandler);

      @Injectable()
      class Test {
        get(@Context() $ctx: any) {
          throw new Forbidden("test");
        }
      }

      PlatformTest.invoke(Test);
      const $ctx = PlatformTest.createRequestContext();

      const handler = platformHandler.createCustomHandler(PlatformTest.injector.getProvider(Test)!, "get");

      const error = await catchAsyncError(() => handler($ctx));

      expect(error?.message).toEqual("test");
    });
  });
  describe("createHandler()", () => {
    describe("native", () => {
      it("should return a native handler (success middleware)", async () => {
        // GIVEN
        jest.spyOn(Test.prototype, "get").mockImplementation((o) => o);

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.ENDPOINT,
          propertyKey: "get"
        });

        const platformHandler = await PlatformTest.invoke<PlatformHandler>(PlatformHandler);
        await PlatformTest.invoke(Test);

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).toBeInstanceOf(Function);
      });
      it("should return a native metadata (from native metadata)", async () => {
        // GIVEN
        const platformHandler = await PlatformTest.invoke<PlatformHandler>(PlatformHandler);
        jest.spyOn(Test.prototype, "get").mockImplementation((o) => o);

        const nativeHandler = (req: any, res: any, next: any) => {};

        // WHEN
        const handler = platformHandler.createHandler(nativeHandler);

        // THEN
        expect(nativeHandler).toEqual(handler);
      });
      it("should call returned function", async () => {
        // GIVEN
        const internalMiddleware = jest.fn().mockImplementation((_1, _2, done) => {
          done();
        });

        @Middleware()
        class Test {
          use(@Context() ctx: Context) {
            return internalMiddleware;
          }
        }

        const platformHandler = await PlatformTest.invoke<PlatformHandler>(PlatformHandler);
        await PlatformTest.invoke<Test>(Test);

        const ctx = PlatformTest.createRequestContext();
        const next = jest.fn();

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.MIDDLEWARE,
          propertyKey: "use"
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        await ctx.runInContext(() => handler(ctx.getRequest(), ctx.getResponse(), next));

        // THEN
        expect(internalMiddleware).toBeCalledWith(ctx.getRequest(), ctx.getResponse(), expect.any(Function));
      });
    });

    describe("ENDPOINT", () => {
      it("should return a native handler with 3 params", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler<PlatformHandler>(PlatformHandler);

        class Test {
          get() {}
        }

        PlatformTest.invoke(Test);

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.ENDPOINT,
          propertyKey: "get"
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).not.toEqual(handlerMetadata.handler);
        expect(handler.length).toEqual(3);
      });
      it("should call the handler - not final", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler<PlatformHandler>(PlatformHandler);

        @Controller("/")
        class Test {
          @Get("/")
          get() {
            return "endpoint";
          }
        }

        PlatformTest.invoke(Test);
        const $ctx = PlatformTest.createRequestContext();
        $ctx.endpoint = EndpointMetadata.get(Test, "get");

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.ENDPOINT,
          propertyKey: "get"
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).not.toEqual(handlerMetadata.handler);
        expect(handler.length).toEqual(3);

        const next = jest.fn();

        await $ctx.runInContext(() => handler($ctx.getRequest(), $ctx.getResponse(), next));

        expect(next).toHaveBeenCalledWith();
      });
      it("should call the handler - not final - lost context", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler<PlatformHandler>(PlatformHandler);

        @Controller("/")
        class Test {
          @Get("/")
          get() {
            return "endpoint";
          }
        }

        PlatformTest.invoke(Test);
        const $ctx = PlatformTest.createRequestContext();
        $ctx.endpoint = EndpointMetadata.get(Test, "get");

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.ENDPOINT,
          propertyKey: "get"
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).not.toEqual(handlerMetadata.handler);
        expect(handler.length).toEqual(3);

        const next = jest.fn();

        await handler($ctx.getRequest(), $ctx.getResponse(), next);

        expect(next).toHaveBeenCalledWith();
      });
      it("should call the handler and flush response - final", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler<PlatformHandler>(PlatformHandler);

        @Controller("/")
        class Test {
          @Get("/")
          @Returns(203).Header("x-test", 1)
          get() {
            return "endpoint";
          }
        }

        PlatformTest.invoke(Test);
        const $ctx = PlatformTest.createRequestContext();
        $ctx.endpoint = EndpointMetadata.get(Test, "get");

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.ENDPOINT,
          propertyKey: "get",
          routeOptions: {
            isFinal: true
          }
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).not.toEqual(handlerMetadata.handler);
        expect(handler.length).toEqual(3);

        const next = jest.fn();

        await $ctx.runInContext(() => handler($ctx.getRequest(), $ctx.getResponse(), next));

        expect(next).toHaveBeenCalledWith();
        expect($ctx.getResponse().data).toEqual("endpoint");
        expect($ctx.getResponse().headers).toEqual({"x-request-id": "id", "x-test": "1"});
        expect($ctx.getResponse().statusCode).toEqual(203);
      });
      it("should call the handler and flush response - with response like - final", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler<PlatformHandler>(PlatformHandler);

        @Controller("/")
        class Test {
          @Get("/")
          get() {
            return {
              data: "data",
              headers: {
                "x-header": "header"
              },
              status: 301,
              statusText: "statusText"
            };
          }
        }

        PlatformTest.invoke(Test);
        const $ctx = PlatformTest.createRequestContext();
        $ctx.endpoint = EndpointMetadata.get(Test, "get");

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.ENDPOINT,
          propertyKey: "get",
          routeOptions: {
            isFinal: true
          }
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).not.toEqual(handlerMetadata.handler);
        expect(handler.length).toEqual(3);

        const next = jest.fn();

        await $ctx.runInContext(() => handler($ctx.getRequest(), $ctx.getResponse(), next));

        expect(next).toHaveBeenCalledWith();
        expect($ctx.getResponse().data).toEqual("data");
        expect($ctx.getResponse().headers).toEqual({"x-request-id": "id", "x-header": "header"});
        expect($ctx.getResponse().statusCode).toEqual(301);
      });
      it("should call the handler and flush stream response - final", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler<PlatformHandler>(PlatformHandler);

        @Controller("/")
        class Test {
          @Get("/")
          @ContentType("application/json")
          get() {
            return createReadStream(join(__dirname, "__mock__/data.txt"));
          }
        }

        PlatformTest.invoke(Test);
        const $ctx = PlatformTest.createRequestContext();
        $ctx.endpoint = EndpointMetadata.get(Test, "get");

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.ENDPOINT,
          propertyKey: "get",
          routeOptions: {
            isFinal: true
          }
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).not.toEqual(handlerMetadata.handler);
        expect(handler.length).toEqual(3);

        const next = jest.fn();

        await $ctx.runInContext(() => handler($ctx.getRequest(), $ctx.getResponse(), next));

        expect($ctx.getResponse().data).toEqual(undefined);
      });
      it("should do nothing when request is aborted", async () => {
        // GIVEN
        const platformHandler = await PlatformTest.invoke<PlatformHandler>(PlatformHandler);

        const $ctx = PlatformTest.createRequestContext();

        $ctx.request.raw.aborted = true;
        $ctx.endpoint = EndpointMetadata.get(Test, "get");

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.ENDPOINT,
          propertyKey: "get"
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);
        const next = jest.fn();

        await $ctx.runInContext(() => handler($ctx.getRequest(), $ctx.getResponse(), next));

        // THEN
        return expect(next).not.toBeCalled();
      });
    });
    describe("MIDDLEWARE", () => {
      it("should return a native handler with 3 params", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler(PlatformHandler);

        class Test {
          use() {}
        }

        PlatformTest.invoke(Test);

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.MIDDLEWARE,
          propertyKey: "use"
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).not.toEqual(handlerMetadata.handler);
        expect(handler.length).toEqual(3);
      });
      it("should return a native handler with 4 params", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler(PlatformHandler);

        class Test {
          use(@Err() err: unknown) {}
        }

        PlatformTest.invoke(Test);

        const metadata = new HandlerMetadata({
          token: Test,
          target: Test,
          type: HandlerType.MIDDLEWARE,
          propertyKey: "use"
        });

        // WHEN
        const handler = platformHandler.createHandler(metadata);

        // THEN
        expect(metadata.hasErrorParam).toEqual(true);
        expect(handler).not.toEqual(metadata.handler);
        expect(handler.length).toEqual(4);

        const $ctx = PlatformTest.createRequestContext();
        const next = jest.fn();

        await catchAsyncError(() =>
          $ctx.runInContext(() => handler(new Forbidden("forbidden"), $ctx.getRequest(), $ctx.getResponse(), next))
        );

        expect(next).toHaveBeenCalledWith();
      });
    });
    describe("$CTX", () => {
      it("should return a native handler with 3 params", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler(PlatformHandler);

        class Test {
          use() {}
        }

        PlatformTest.invoke(Test);

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: (ctx: any) => {},
          type: HandlerType.CTX_FN
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).not.toEqual(handlerMetadata.handler);
        expect(handler.length).toEqual(3);
      });
      it("should catch error from handler", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler(PlatformHandler);

        class Test {
          use() {}
        }

        const error = new Error("test");
        PlatformTest.invoke(Test);

        const $ctx = PlatformTest.createRequestContext();

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: (ctx: any) => {
            throw error;
          },
          type: HandlerType.CTX_FN
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).not.toEqual(handlerMetadata.handler);
        expect(handler.length).toEqual(3);

        const next = jest.fn();

        await $ctx.runInContext(() => handler($ctx.getRequest(), $ctx.getResponse(), next));

        expect(next).toBeCalledWith(error);
      });
    });
    describe("FUNCTION", () => {
      it("should return a native handler with 3 params", async () => {
        // GIVEN
        const platformHandler = await invokePlatformHandler(PlatformHandler);

        class Test {
          use() {}
        }

        PlatformTest.invoke(Test);

        const handlerMetadata = new HandlerMetadata({
          token: Test,
          target: (req: any, res: any, next: any) => {},
          type: HandlerType.RAW_FN
        });

        // WHEN
        const handler = platformHandler.createHandler(handlerMetadata);

        // THEN
        expect(handler).toEqual(handlerMetadata.handler);
      });
    });
  });
});
