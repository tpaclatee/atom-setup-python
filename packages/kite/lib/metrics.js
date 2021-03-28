'use strict';

var os = require('os');
const crypto = require('crypto');
const KiteAPI = require('kite-api');
const { metricsCounterPath } = require('./urls');
const localconfig = require('./localconfig.js');

const version = require('../package.json').version;

const OS_VERSION = os.type() + ' ' + os.release();

const EDITOR_UUID = localStorage.getItem('metrics.userId');

// Generate a unique ID for this user and save it for future use.
function distinctID() {
  var id = localconfig.get('distinctID');
  if (id === undefined) {
    // use the atom UUID
    id = EDITOR_UUID || crypto.randomBytes(32).toString('hex');
    localconfig.set('distinctID', id);
  }
  return id;
}

function sendFeatureMetric(name) {
  const path = metricsCounterPath();
  console.log(name);

  return (
    !atom.inSpecMode() &&
    KiteAPI.request(
      {
        path,
        method: 'POST',
      },
      JSON.stringify({
        name,
        value: 1,
      })
    ).catch(() => {})
  );
}

function featureRequested(name) {
  sendFeatureMetric(`atom_${name}_requested`);
}

function featureFulfilled(name) {
  sendFeatureMetric(`atom_${name}_fulfilled`);
}

function featureApplied(name, suffix = '') {
  sendFeatureMetric(`atom_${name}_applied${suffix}`);
}

function record(name, action) {
  sendFeatureMetric(`atom_${name}_${action}`);
}

function getOsName() {
  switch (os.platform()) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      return '';
  }
}

module.exports = {
  distinctID,
  featureApplied,
  sendFeatureMetric,
  featureRequested,
  featureFulfilled,
  record,
  getOsName,
  version,
  EDITOR_UUID,
  OS_VERSION,
};
