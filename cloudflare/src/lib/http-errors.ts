/** Sentinel errors the entry point knows how to translate into responses. */

export class NotFound extends Error {
  constructor() {
    super("Route not found");
    this.name = "NotFound";
  }
}

export class MethodMismatch extends Error {
  constructor() {
    super("Method not allowed");
    this.name = "MethodMismatch";
  }
}
