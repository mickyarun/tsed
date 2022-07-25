import {ParamTypes} from "../domain/ParamTypes";
import {Locals} from "./locals";
import {JsonParameterStore} from "@tsed/schema";

describe("@Locals", () => {
  it("should call ParamFilter.useParam method with the correct parameters", () => {
    class Ctrl {
      test(@Locals("expression") test: any) {}
    }

    const param = JsonParameterStore.get(Ctrl, "test", 0);
    expect(param.expression).toEqual("expression");
    expect(param.paramType).toEqual(ParamTypes.LOCALS);
  });
});
