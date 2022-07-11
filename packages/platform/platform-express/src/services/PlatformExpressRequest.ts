import {PlatformRequest} from "@tsed/common";
import type Express from "express";

/**
 * @platform
 * @express
 * @deprecated
 */
export class PlatformExpressRequest extends PlatformRequest<Express.Request> {}
