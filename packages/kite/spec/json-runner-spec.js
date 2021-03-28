'use strict';

const path = require('path');
const KiteAPI = require('kite-api');
const KiteConnect = require('kite-connector');

const {withKite, withKiteRoutes} = require('kite-api/test/helpers/kite');
const {fakeResponse} = require('kite-connector/test/helpers/http');
const {jsonPath, walk, describeForTest, featureSetPath, substituteFromContext, buildContext, inLiveEnvironment} = require('./json/utils');
const NodeClient = require('kite-connector/lib/clients/node');
// const BrowserClient = require('kite-connector/lib/clients/browser');

const ACTIONS = {};
const EXPECTATIONS = {};

walk(path.resolve(__dirname, 'json', 'actions'), '.js', file => {
  const key = path.basename(file).replace(path.extname(file), '');
  ACTIONS[key] = require(file);
});

walk(path.resolve(__dirname, 'json', 'expectations'), '.js', file => {
  const key = path.basename(file).replace(path.extname(file), '');
  EXPECTATIONS[key] = require(file);
});

const featureSet = require(featureSetPath());

describe('JSON tests', () => {
  beforeEach(() => {
    jasmine.useRealClock();
    const jasmineContent = document.querySelector('#jasmine-content');

    const workspaceElement = atom.views.getView(atom.workspace);

    jasmineContent.appendChild(workspaceElement);

    atom.config.set('autocomplete-plus.enableAutoActivation', true);
    atom.config.set('autocomplete-plus.autoActivationDelay', 0);

    waitsForPromise({
      label: 'autocomplete-plus package activation',
    }, () => atom.packages.activatePackage('autocomplete-plus'));
    waitsForPromise({
      label: 'language-python package activation',
    }, () => atom.packages.activatePackage('language-python'));
  });

  featureSet.forEach(feature => {
    walk(jsonPath('tests', feature), (testFile) => {
      buildTest(require(testFile), testFile);
    });
  });

});

function kiteSetup(setup) {
  switch (setup) {
    case 'authenticated':
      return {logged: true};
    case 'unsupported':
    case 'not_supported':
      return {supported: false};
    case 'uninstalled':
    case 'not_installed':
      return {installed: false};
    case 'not_running':
      return {running: false};
    case 'unreachable':
    case 'not_reachable':
      return {reachable: false};
    case 'unlogged':
    case 'not_logged':
      return {logged: false};
    default:
      return {supported: false};
  }
}

function buildTest(data, file) {
  if (data.live_environment === false) {
    return;
  }

  describeForTest(data, `${data.description} ('${file}')`, () => {
    withKite(kiteSetup(data.setup.kited), () => {
      beforeEach(() => {
        if (inLiveEnvironment()) {
          KiteConnect.client = new NodeClient('localhost', '56624');
          waitsForPromise(() => KiteConnect.request({
            path: '/testapi/request-history/reset',
            method: 'POST',
          }));
        }

        runs(() => {
          spyOn(KiteAPI, 'request').andCallThrough();
          atom.project.setPaths([path.resolve(__dirname, '..')]);
        });

        waitsForPromise({label: 'kite activation'}, () => atom.packages.activatePackage('kite'));
        // console.log('start ------------------------------------------');
      });

      afterEach(() => {
        // console.log('end ------------------------------------------');
      });
      const block = () => {
        data.test.reverse().reduce((f, s) => {
          switch (s.step) {
            case 'action':
              return buildAction(s, data, f);
            case 'expect':
              return buildExpectation(s, data, f);
            case 'expect_not':
              return buildExpectation(s, data, f, true);
            default:
              return f;
          }
        }, () => {})();
      };
      if (!inLiveEnvironment() && /reachable|authenticated/.test(data.setup.kited)) {
        if (data.setup.routes) {
          withKiteRoutes(data.setup.routes.map(r => {
            const reg = new RegExp(substituteFromContext(r.match, buildContext()));

            return [
              o => reg.test(o.path),
              o => {
                if (r.response.body) {
                  const body = require(jsonPath(r.response.body));
                  return fakeResponse(r.response.status, JSON.stringify(body));
                } else {
                  return fakeResponse(r.response.status);
                }
              },
            ];

          }));
        }
        block();
      } else {
        block();
      }
    });
  });
}

function buildAction(action, testData, block) {
  return () => describe(action.description, () => {
    ACTIONS[action.type] && ACTIONS[action.type](action, testData);

    describe('', () => {
      block && block();
    });
  });
}

function buildExpectation(expectation, testData, block, not) {
  return () => {

    EXPECTATIONS[expectation.type] && EXPECTATIONS[expectation.type](expectation, not, testData);

    describe('', () => {
      block && block();
    });
  };
}
