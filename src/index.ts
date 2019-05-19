import debug = require("debug");
import pathToRegexp = require("path-to-regexp");
import { Request, Response } from "servie";
import { format, parse } from "url";

const log = debug("servie-mount");

export const mountPath = Symbol("mountPath");
export const originalUrl = Symbol("originalUrl");

export interface MountRequest {
  [originalUrl]: string;
  [mountPath]: string[];
}

export interface Options {
  sensitive?: boolean;
}

export function mount<T extends Request, U extends Response>(
  prefix: pathToRegexp.Path,
  fn: (req: T & MountRequest, done: () => Promise<U>) => Promise<U>,
  options: Options = {}
) {
  const keys: pathToRegexp.Key[] = [];
  const re = pathToRegexp(prefix, keys, {
    end: false,
    sensitive: options.sensitive
  });

  log(`mount ${prefix} -> ${re}`);

  return function(req: T & Partial<MountRequest>, next: () => Promise<U>) {
    const Url = parse(req.url);
    if (!Url.pathname) return next();

    const match = re.exec(Url.pathname);
    if (!match) return next();

    const prevUrl = req.url;
    const prevMountPath = req[mountPath];

    req.url = format({
      ...Url,
      path: undefined,
      pathname: Url.pathname.substr(match[0].length) || "/"
    });

    // Set mounted parameters on request.
    const mountReq = Object.assign(req, {
      [mountPath]: Array.from(match),
      [originalUrl]: req[originalUrl] || prevUrl
    });

    debug(`enter ${prevUrl} -> ${req.url}`);

    return fn(mountReq, function() {
      debug(`leave ${prevUrl} -> ${req.url}`);
      req.url = prevUrl;
      req[mountPath] = prevMountPath;
      return next();
    });
  };
}
