import {Controller, ExpressRouter, Get, Render, RouteService} from "@tsed/common";

@Controller("/rest")
export class RestCtrl {
  // tslint:disable-next-line: no-unused-variable
  constructor(private routeService: RouteService, @ExpressRouter private router: ExpressRouter) {
    /*router.get(/(test)/, (res, req) => {

        });*/
  }

  @Get("/html")
  @Render("rest")
  public render() {
    return {endpoints: JSON.parse(JSON.stringify(this.routeService.getAll()))};
  }
}
