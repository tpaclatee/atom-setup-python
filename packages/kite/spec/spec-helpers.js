'use strict';

const os = require('os');
const http = require('http');
const proc = require('child_process');
const {merge} = require('../lib/utils');
const {withKiteRoutes} = require('kite-api/test/helpers/kite');
const KiteAPI = require('kite-api');

beforeEach(function() {
  atom.config.set('core.useTreeSitterParsers', false);
  atom.config.set('kite.loggingLevel', 'error');
  atom.config.set('kite.showEditorVacanciesNotificationOnStartup', false);
  atom.config.set('kite.showWelcomeNotificationOnStartup', false);
  atom.config.set('kite.editorMetricsEnabled', 'no');

  const styles = document.createElement('style');
  styles.textContent = `
.spec-reporter .result-message.fail, .spec-reporter .stack-trace.padded {
  text-overflow: none;
  display: block;
  -webkit-box-orient: initial;
  -webkit-line-clamp: initial;
  overflow: visible;
}`;
  document.body.appendChild(styles);

  this.addMatchers({
    toHaveBeenCalledWithPath(expected) {
      const pass = this.actual.calls.some(call => call.args[0].path === expected);

      if (pass) {
        this.message = () =>
          `Expected ${this.actual.methodName} to have been called with path '${expected}'`;
      } else {
        this.message = () =>
          `Expected ${this.actual.methodName} to have been called with path '${expected}' but it hasn't`;
      }

      return pass;
    },
    toHaveBeenCalledWithPayload(expected) {
      const payload = JSON.parse(this.actual.mostRecentCall.args[1]);
      const payloadKeys = Object.keys(payload);
      const expectedKeys = Object.keys(expected);

      if (payloadKeys.length !== expectedKeys.length) {
        this.message = () =>
          `Expected ${this.actual.methodName} to have been called with payload containing '${expectedKeys}' but payload had '${payloadKeys}'`;
        return false;
      }

      if (!payloadKeys.every(k => expectedKeys.includes(k))) {
        this.message = () =>
        `Expected ${this.actual.methodName} to have been called with payload containing '${expectedKeys}' but payload had '${payloadKeys}'`;
        return false;
      }

      if (!this.env.equals_(expected, payload)) {
        this.message = () =>
        `Expected ${this.actual.methodName} to have been called with payload '${JSON.stringify(expected)}' but it was with '${JSON.stringify(payload)}'`;
        return false;
      }

      this.message = () =>
        `Expected ${this.actual.methodName} to have been called with payload '${JSON.stringify(expected)}'`;
      return true;
    },
  });
});

function sleep(duration) {
  const t = new Date();
  waitsFor(`${duration}ms`, () => { return new Date() - t > duration; });
}

function fakeStdStream() {
  let streamCallback;
  function stream(data) {
    streamCallback && streamCallback(data);
  }

  stream.on = (evt, callback) => {
    if (evt === 'data') { streamCallback = callback; }
  };

  return stream;
}

let _processes;
function fakeProcesses(processes) {
  if (proc.spawn.isSpy) {
    _processes = merge(_processes, processes);
  } else {
    spyOn(proc, 'spawn').andCallFake((process, options) => {
      const mock = _processes[process];
      const ps = {
        stdout: fakeStdStream(),
        stderr: fakeStdStream(),
        on: (evt, callback) => {
          if (evt === 'close') { callback(mock ? mock(ps, options) : 1); }
        },
      };

      return ps;
    });

    spyOn(proc, 'spawnSync').andCallFake((process, options) => {
      const mock = _processes[process];

      const ps = {};
      ps.status = mock ? mock({
        stdout(data) { ps.stdout = data; },
        stderr(data) { ps.stderr = data; },
      }, options) : 1;

      return ps;
    });


    _processes = processes;
  }

  if (processes.exec && !proc.exec.isSpy) {
    spyOn(proc, 'exec').andCallFake((process, options, callback) => {
      const mock = _processes.exec[process];

      let stdout, stderr;

      const status = mock ? mock({
        stdout(data) { stdout = data; },
        stderr(data) { stderr = data; },
      }, options) : 1;

      status === 0
      ? callback(null, stdout)
      : callback({}, stdout, stderr);
    });
  }
}

function fakeResponse(statusCode, data, props) {
  data = data || '';
  props = props || {};

  const resp = {
    statusCode,
    req: {},
    on(event, callback) {
      switch (event) {
        case 'data':
          callback(data);
          break;
        case 'end':
          callback();
          break;
      }
    },
  };
  for (let k in props) { resp[k] = props[k]; }
  resp.headers = resp.headers || {};
  return resp;
}

function fakeRequestMethod(resp) {
  if (resp) {
    switch (typeof resp) {
      case 'boolean':
        resp = fakeResponse(200);
        break;
      case 'object':
        resp = fakeResponse(200, '', resp);
        break;
      case 'string':
        resp = fakeResponse(200, resp, {});
        break;
    }
  }

  return (opts, callback) => ({
    on(type, cb) {
      switch (type) {
        case 'error':
          if (resp === false) { cb({}); }
          break;
        case 'response':
          if (resp) { cb(typeof resp == 'function' ? resp(opts) : resp); }
          break;
      }
    },
    end() {
      if (resp) {
        typeof resp == 'function'
          ? callback(resp(opts))
          : callback(resp);
      }
    },
    write(data) {},
    setTimeout(timeout, callback) {
      if (resp == null) { callback({}); }
    },
  });
}

function fakeKiteInstallPaths() {
  beforeEach(() => {
    fakeProcesses({
      'mdfind': (ps) => {
        ps.stdout('');
        return 0;
      },
    });
  });
}

function fakeRouter(routes) {
  return (opts) => {
    for (let i = 0; i < routes.length; i++) {
      const [predicate, handler] = routes[i];
      if (predicate(opts)) { return handler(opts); }
    }
    return fakeResponse(200);
  };
}

function withKiteInstalled(block) {
  describe('with kite installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"com.kite.Kite"'
          ? ps.stdout('/Applications/Kite.app')
          : ps.stdout('');
          return 0;
        },
      });
    });

    block();
  });
}

function withManyKiteInstalled(block) {
  describe('with many kite installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"com.kite.Kite"'
          ? ps.stdout('/Applications/Kite.app\n/Users/kite/Kite.app')
          : ps.stdout('');
          return 0;
        },
      });
    });

    block();
  });
}

function withKiteEnterpriseInstalled(block) {
  describe('with kite enterprise installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"enterprise.kite.Kite"'
          ? ps.stdout('/Applications/KiteEnterprise.app')
          : ps.stdout('');
          return 0;
        },
      });
    });

    block();
  });
}

function withManyKiteEnterpriseInstalled(block) {
  describe('with many kite enterprise installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"enterprise.kite.Kite"'
          ? ps.stdout('/Applications/KiteEnterprise.app\n/Users/kite/KiteEnterprise.app')
          : ps.stdout('');
          return 0;
        },
      });
    });

    block();
  });
}

function withBothKiteInstalled(block) {
  describe('with both kite and kite enterprise installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"enterprise.kite.Kite"'
          ? ps.stdout('/Applications/KiteEnterprise.app')
          : ps.stdout('/Applications/Kite.app');
          return 0;
        },
      });
    });

    block();
  });
}

function withManyOfBothKiteInstalled(block) {
  describe('with many of both kite and kite enterprise installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"enterprise.kite.Kite"'
          ? ps.stdout('/Applications/KiteEnterprise.app\n/Users/kite/KiteEnterprise.app')
          : ps.stdout('/Applications/Kite.app\n/Users/kite/Kite.app');
          return 0;
        },
      });
    });

    block();
  });
}

function withKiteRunning(block) {
  withKiteInstalled(() => {
    describe(', running', () => {
      beforeEach(() => {
        fakeProcesses({
          ls: (ps) => ps.stdout('kite'),
          '/bin/ps': (ps) => {
            ps.stdout('Kite');
            return 0;
          },
        });
      });

      block();
    });
  });
}

function withKiteNotRunning(block) {
  withKiteInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withManyKiteNotRunning(block) {
  withManyKiteInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withKiteEnterpriseRunning(block) {
  withKiteEnterpriseInstalled(() => {
    describe(', running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('KiteEnterprise');
            return 0;
          },
        });
      });

      block();
    });
  });
}

function withKiteEnterpriseNotRunning(block) {
  withKiteEnterpriseInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withManyKiteEnterpriseNotRunning(block) {
  withManyKiteEnterpriseInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withBothKiteNotRunning(block) {
  withBothKiteInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withManyOfBothKiteNotRunning(block) {
  withManyOfBothKiteInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withFakeServer(routes, block) {
  if (typeof routes == 'function') {
    block = routes;
    routes = [];
  }

  routes.push([o => true, o => fakeResponse(404)]);

  describe('', () => {
    beforeEach(function() {
      this.routes = routes.concat();
      const router = fakeRouter(this.routes);
      spyOn(http, 'request').andCallFake(fakeRequestMethod(router));
    });

    block();
  });
}

function withKiteReachable(routes, block) {
  if (typeof routes == 'function') {
    block = routes;
    routes = [];
  }

  routes.push([o => o.path === '/settings', o => fakeResponse(200)]);
  routes.push([o => o.path === '/clientapi/user', o => fakeResponse(200, '{}')]);

  withKiteRunning(() => {
    describe(', reachable', () => {
      withFakeServer(routes, () => {
        block();
      });
    });
  });
}

function withKiteNotReachable(block) {
  withKiteRunning(() => {
    describe(', not reachable', () => {
      beforeEach(() => {
        spyOn(http, 'request').andCallFake(fakeRequestMethod(false));
      });

      block();
    });
  });
}

function withKiteAuthenticated(routes, block) {
  if (typeof routes == 'function') {
    block = routes;
    routes = [];
  }

  routes.push([
    o => /^\/clientapi\/user/.test(o.path),
    o => fakeResponse(200, 'authenticated'),
  ]);

  withKiteReachable(routes, () => {
    describe(', authenticated', () => {
      block();
    });
  });
}

function withKiteNotAuthenticated(block) {
  withKiteReachable([
    [o => o.path === '/clientapi/user', o => fakeResponse(401)],
  ], () => {
    describe(', not authenticated', () => {
      block();
    });
  });
}

function withRoutes(routes) {
  beforeEach(function() {
    routes.reverse().forEach(route => this.routes.unshift(route));
  });
}

function newCallTo(endpoint) {
  const initialCount = countCalls();
  return () => countCalls() > initialCount;

  function countCalls() {
    return KiteAPI.request.calls.filter(c => {
      const {path} = c.args[0];
      return typeof endpoint == 'string'
        ? path === endpoint
        : endpoint.test(path);
    }).length;
  }
}

module.exports = {
  fakeProcesses, fakeRequestMethod, fakeResponse, fakeKiteInstallPaths,

  withKiteInstalled, withManyKiteInstalled,
  withKiteEnterpriseInstalled, withManyKiteEnterpriseInstalled,
  withBothKiteInstalled, withManyOfBothKiteInstalled,

  withKiteRunning, withKiteNotRunning, withManyKiteNotRunning,
  withKiteEnterpriseRunning, withKiteEnterpriseNotRunning,
  withManyKiteEnterpriseNotRunning,
  withBothKiteNotRunning, withManyOfBothKiteNotRunning,

  withKiteReachable, withKiteNotReachable,
  withKiteAuthenticated, withKiteNotAuthenticated,
  withFakeServer, withRoutes,
  sleep, newCallTo,
};
