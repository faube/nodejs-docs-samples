// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const {assert} = require('chai');
const {v4: uuidv4} = require('uuid');

const {ParameterManagerClient} = require('@google-cloud/parametermanager');
const client = new ParameterManagerClient();

const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const secretClient = new SecretManagerServiceClient();

const {KeyManagementServiceClient} = require('@google-cloud/kms');
const kmsClient = new KeyManagementServiceClient();

let projectId;
const locationId = process.env.GCLOUD_LOCATION || 'us-central1';
const options = {};
options.apiEndpoint = `parametermanager.${locationId}.rep.googleapis.com`;

const regionalClient = new ParameterManagerClient(options);

const secretOptions = {};
secretOptions.apiEndpoint = `secretmanager.${locationId}.rep.googleapis.com`;

const regionalSecretClient = new SecretManagerServiceClient(secretOptions);

const secretId = `test-secret-${uuidv4()}`;
const parameterId = `test-parameter-${uuidv4()}`;
const regionalParameterId = `test-regional-${uuidv4()}`;
const parameterVersionId = `test-version-${uuidv4()}`;

const keyRingId = 'node-test-kms-key';
const keyId = `test-parameter-${uuidv4()}`;
const keyId1 = `test-parameter-${uuidv4()}`;

const jsonPayload = '{username: "test-user", host: "localhost"}';
const payload = 'This is unstructured data';

let parameter;
let regionalParameter;
let secret;
let secretVersion;
let parameterToDelete;
let regionalParameterToDelete;
let parameterVersion;
let regionalParameterVersion;
let regionalSecret;
let regionalSecretVersion;

let keyRing;
let kmsKey;
let kmsKey1;

let regionalKeyRing;
let regionalKmsKey;
let regionalKmsKey1;

describe('Parameter Manager samples', () => {
  const parametersToDelete = [];
  const parameterVersionsToDelete = [];
  const regionalParametersToDelete = [];
  const regionalParameterVersionsToDelete = [];

  before(async () => {
    projectId = await client.getProjectId();
    keyRing = `projects/${projectId}/locations/global/keyRings/${keyRingId}`;
    kmsKey = `projects/${projectId}/locations/global/keyRings/${keyRingId}/cryptoKeys/${keyId}`;
    kmsKey1 = `projects/${projectId}/locations/global/keyRings/${keyRingId}/cryptoKeys/${keyId1}`;
    regionalKeyRing = `projects/${projectId}/locations/${locationId}/keyRings/${keyRingId}`;
    regionalKmsKey = `projects/${projectId}/locations/${locationId}/keyRings/${keyRingId}/cryptoKeys/${keyId}`;
    regionalKmsKey1 = `projects/${projectId}/locations/${locationId}/keyRings/${keyRingId}/cryptoKeys/${keyId1}`;

    // Create a secret
    [secret] = await secretClient.createSecret({
      parent: `projects/${projectId}`,
      secretId: secretId,
      secret: {
        replication: {
          automatic: {},
        },
      },
    });

    // Create a secret version
    [secretVersion] = await secretClient.addSecretVersion({
      parent: secret.name,
      payload: {
        data: Buffer.from('my super secret data', 'utf-8'),
      },
    });

    // Create a test global parameter
    [parameter] = await client.createParameter({
      parent: `projects/${projectId}/locations/global`,
      parameterId: parameterId,
      parameter: {
        format: 'JSON',
      },
    });
    parametersToDelete.push(parameter.name);

    // Create a test regional parameter
    [regionalParameter] = await regionalClient.createParameter({
      parent: `projects/${projectId}/locations/${locationId}`,
      parameterId: regionalParameterId,
      parameter: {
        format: 'JSON',
      },
    });
    regionalParametersToDelete.push(regionalParameter.name);

    // Create a test global parameter for delete use case
    [parameterToDelete] = await client.createParameter({
      parent: `projects/${projectId}/locations/global`,
      parameterId: parameterId + '-3',
      parameter: {
        format: 'JSON',
      },
    });
    parametersToDelete.push(parameterToDelete.name);

    // Create a version for the global parameter
    [parameterVersion] = await client.createParameterVersion({
      parent: parameter.name,
      parameterVersionId: parameterVersionId,
      parameterVersion: {
        payload: {
          data: Buffer.from(JSON.stringify({key: 'global_value'}), 'utf-8'),
        },
      },
    });
    parameterVersionsToDelete.push(parameterVersion.name);

    // Create a test regional parameter for delete use case
    [regionalParameterToDelete] = await regionalClient.createParameter({
      parent: `projects/${projectId}/locations/${locationId}`,
      parameterId: regionalParameterId + '-3',
      parameter: {
        format: 'JSON',
      },
    });
    regionalParametersToDelete.push(regionalParameterToDelete.name);

    // Create a version for the regional parameter
    [regionalParameterVersion] = await regionalClient.createParameterVersion({
      parent: regionalParameter.name,
      parameterVersionId: parameterVersionId,
      parameterVersion: {
        payload: {
          data: Buffer.from(JSON.stringify({key: 'regional_value'}), 'utf-8'),
        },
      },
    });
    regionalParameterVersionsToDelete.push(regionalParameterVersion.name);

    // Create a regional secret
    [regionalSecret] = await regionalSecretClient.createSecret({
      parent: `projects/${projectId}/locations/${locationId}`,
      secretId: secretId,
    });

    // Create a regional secret version
    [regionalSecretVersion] = await regionalSecretClient.addSecretVersion({
      parent: regionalSecret.name,
      payload: {
        data: Buffer.from('my super secret data', 'utf-8'),
      },
    });

    try {
      await kmsClient.getKeyRing({name: keyRing});
    } catch (error) {
      if (error.code === 5) {
        await kmsClient.createKeyRing({
          parent: kmsClient.locationPath(projectId, 'global'),
          keyRingId: keyRingId,
        });
      }
    }

    try {
      await kmsClient.getKeyRing({name: regionalKeyRing});
    } catch (error) {
      if (error.code === 5) {
        await kmsClient.createKeyRing({
          parent: kmsClient.locationPath(projectId, locationId),
          keyRingId: keyRingId,
        });
      }
    }

    try {
      await kmsClient.getCryptoKey({name: kmsKey});
    } catch (error) {
      if (error.code === 5) {
        await kmsClient.createCryptoKey({
          parent: kmsClient.keyRingPath(projectId, 'global', keyRingId),
          cryptoKeyId: keyId,
          cryptoKey: {
            purpose: 'ENCRYPT_DECRYPT',
            versionTemplate: {
              algorithm: 'GOOGLE_SYMMETRIC_ENCRYPTION',
              protectionLevel: 'HSM',
            },
          },
        });
      }
    }

    try {
      await kmsClient.getCryptoKey({name: regionalKmsKey});
    } catch (error) {
      if (error.code === 5) {
        await kmsClient.createCryptoKey({
          parent: kmsClient.keyRingPath(projectId, locationId, keyRingId),
          cryptoKeyId: keyId,
          cryptoKey: {
            purpose: 'ENCRYPT_DECRYPT',
            versionTemplate: {
              algorithm: 'GOOGLE_SYMMETRIC_ENCRYPTION',
              protectionLevel: 'HSM',
            },
          },
        });
      }
    }

    try {
      await kmsClient.getCryptoKey({name: kmsKey1});
    } catch (error) {
      if (error.code === 5) {
        await kmsClient.createCryptoKey({
          parent: kmsClient.keyRingPath(projectId, 'global', keyRingId),
          cryptoKeyId: keyId1,
          cryptoKey: {
            purpose: 'ENCRYPT_DECRYPT',
            versionTemplate: {
              algorithm: 'GOOGLE_SYMMETRIC_ENCRYPTION',
              protectionLevel: 'HSM',
            },
          },
        });
      }
    }

    try {
      await kmsClient.getCryptoKey({name: regionalKmsKey1});
    } catch (error) {
      if (error.code === 5) {
        await kmsClient.createCryptoKey({
          parent: kmsClient.keyRingPath(projectId, locationId, keyRingId),
          cryptoKeyId: keyId1,
          cryptoKey: {
            purpose: 'ENCRYPT_DECRYPT',
            versionTemplate: {
              algorithm: 'GOOGLE_SYMMETRIC_ENCRYPTION',
              protectionLevel: 'HSM',
            },
          },
        });
      }
    }
  });

  after(async () => {
    // Delete all parameter versions first
    await Promise.all(
      parameterVersionsToDelete.map(async parameterVersionName => {
        try {
          await client.deleteParameterVersion({
            name: parameterVersionName,
          });
        } catch (err) {
          if (!err.message.includes('NOT_FOUND')) {
            throw err;
          }
        }
      })
    );

    // Delete all parameters
    await Promise.all(
      parametersToDelete.map(async parameterName => {
        try {
          await client.deleteParameter({
            name: parameterName,
          });
        } catch (err) {
          if (!err.message.includes('NOT_FOUND')) {
            throw err;
          }
        }
      })
    );

    try {
      await secretClient.deleteSecret({
        name: secret.name,
      });
    } catch (err) {
      if (!err.message.includes('NOT_FOUND')) {
        throw err;
      }
    }

    // Delete all regional parameter versions first
    await Promise.all(
      regionalParameterVersionsToDelete.map(
        async regionalParameterVersionName => {
          try {
            await regionalClient.deleteParameterVersion({
              name: regionalParameterVersionName,
            });
          } catch (err) {
            if (!err.message.includes('NOT_FOUND')) {
              throw err;
            }
          }
        }
      )
    );

    // Delete all regional parameters
    await Promise.all(
      regionalParametersToDelete.map(async regionalParameterName => {
        try {
          await regionalClient.deleteParameter({name: regionalParameterName});
        } catch (err) {
          if (!err.message.includes('NOT_FOUND')) {
            throw err;
          }
        }
      })
    );

    try {
      await regionalSecretClient.deleteSecret({
        name: regionalSecret.name,
      });
    } catch (err) {
      if (!err.message.includes('NOT_FOUND')) {
        throw err;
      }
    }

    try {
      await kmsClient.destroyCryptoKeyVersion({
        name: `${kmsKey}/cryptoKeyVersions/1`,
      });
    } catch (error) {
      if (error.code === 5) {
        // If the method is not found, skip it.
      }
    }

    try {
      await kmsClient.destroyCryptoKeyVersion({
        name: `${kmsKey1}/cryptoKeyVersions/1`,
      });
    } catch (error) {
      if (error.code === 5) {
        // If the method is not found, skip it.
      }
    }

    try {
      await kmsClient.destroyCryptoKeyVersion({
        name: `${regionalKmsKey}/cryptoKeyVersions/1`,
      });
    } catch (error) {
      if (error.code === 5) {
        // If the method is not found, skip it.
      }
    }

    try {
      await kmsClient.destroyCryptoKeyVersion({
        name: `${regionalKmsKey1}/cryptoKeyVersions/1`,
      });
    } catch (error) {
      if (error.code === 5) {
        // If the method is not found, skip it.
      }
    }
  });

  it('should create parameter version with secret references', async () => {
    const sample = require('../createParamVersionWithSecret');
    const parameterVersion = await sample.main(
      projectId,
      parameterId,
      parameterVersionId + '-1',
      secretVersion.name
    );
    parameterVersionsToDelete.push(parameterVersion.name);
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}/versions/${parameterVersionId}-1`
    );
  });

  it('should create a structured parameter', async () => {
    const sample = require('../createStructuredParam');
    const parameter = await sample.main(projectId, parameterId + '-1');
    parametersToDelete.push(parameter.name);
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}-1`
    );
  });

  it('should create a unstructured parameter', async () => {
    const sample = require('../createParam');
    const parameter = await sample.main(projectId, parameterId + '-2');
    parametersToDelete.push(parameter.name);
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}-2`
    );
  });

  it('should create a structured parameter version', async () => {
    const sample = require('../createStructuredParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      parameterId + '-1',
      parameterVersionId + '-2',
      jsonPayload
    );
    parameterVersionsToDelete.push(parameterVersion.name);
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}-1/versions/${parameterVersionId}-2`
    );
  });

  it('should create a unstructured parameter version', async () => {
    const sample = require('../createParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      parameterId + '-2',
      parameterVersionId + '-3',
      payload
    );
    parameterVersionsToDelete.push(parameterVersion.name);
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}-2/versions/${parameterVersionId}-3`
    );
  });

  it('should list parameters', async () => {
    const sample = require('../listParams');
    const parameters = await sample.main(projectId);
    assert.exists(parameters);
  });

  it('should get a parameter', async () => {
    const sample = require('../getParam');
    const parameter = await sample.main(projectId, parameterId);
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}`
    );
  });

  it('should list parameter versions', async () => {
    const sample = require('../listParamVersions');
    const parameterVersions = await sample.main(projectId, parameterId);
    assert.exists(parameterVersions);
  });

  it('should get a parameter version', async () => {
    const sample = require('../getParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      parameterId,
      parameterVersionId + '-1'
    );
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}/versions/${parameterVersionId}-1`
    );
  });

  it('should render parameter version', async () => {
    // Get the current IAM policy.
    const [policy] = await secretClient.getIamPolicy({
      resource: secret.name,
    });

    // Add the user with accessor permissions to the bindings list.
    policy.bindings.push({
      role: 'roles/secretmanager.secretAccessor',
      members: [parameter.policyMember.iamPolicyUidPrincipal],
    });

    // Save the updated IAM policy.
    await secretClient.setIamPolicy({
      resource: secret.name,
      policy: policy,
    });

    const sample = require('../renderParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      parameterId,
      parameterVersionId + '-1'
    );
    assert.exists(parameterVersion);
  });

  it('should create a parameter with kms_key', async () => {
    const sample = require('../createParamWithKmsKey');
    const parameter = await sample.main(projectId, parameterId + '-4', kmsKey);
    parametersToDelete.push(
      `projects/${projectId}/locations/global/parameters/${parameterId}-4`
    );
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}-4`
    );
  });

  it('should create a regional parameter with kms_key', async () => {
    const sample = require('../regional_samples/createRegionalParamWithKmsKey');
    const parameter = await sample.main(
      projectId,
      locationId,
      regionalParameterId + '-4',
      regionalKmsKey
    );
    regionalParametersToDelete.push(
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}-4`
    );
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}-4`
    );
  });

  it('should update a parameter with kms_key', async () => {
    const sample = require('../updateParamKmsKey');
    const parameter = await sample.main(projectId, parameterId, kmsKey);
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}`
    );
  });

  it('should update a regional parameter with kms_key', async () => {
    const sample = require('../regional_samples/updateRegionalParamKmsKey');
    const parameter = await sample.main(
      projectId,
      locationId,
      regionalParameterId,
      regionalKmsKey
    );
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}`
    );
  });

  it('should remove a kms_key for parameter', async () => {
    const sample = require('../removeParamKmsKey');
    const parameter = await sample.main(projectId, parameterId);
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}`
    );
  });

  it('should remove a kms_key for regional parameter', async () => {
    const sample = require('../regional_samples/removeRegionalParamKmsKey');
    const parameter = await sample.main(
      projectId,
      locationId,
      regionalParameterId
    );
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}`
    );
  });

  it('should runs the quickstart', async () => {
    const sample = require('../quickstart');
    const parameterVersion = await sample.main(
      projectId,
      parameterId + '-quickstart',
      parameterVersionId
    );
    parametersToDelete.push(
      `projects/${projectId}/locations/global/parameters/${parameterId}-quickstart`
    );
    parameterVersionsToDelete.push(parameterVersion.name);
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}-quickstart/versions/${parameterVersionId}`
    );
  });

  it('should runs the regional quickstart', async () => {
    const sample = require('../regional_samples/regionalQuickstart');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId + '-quickstart',
      parameterVersionId
    );
    regionalParametersToDelete.push(
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}-quickstart`
    );
    regionalParameterVersionsToDelete.push(parameterVersion.name);
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}-quickstart/versions/${parameterVersionId}`
    );
  });

  it('should disable a parameter version', async () => {
    const sample = require('../disableParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      parameterId,
      parameterVersionId
    );
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}/versions/${parameterVersionId}`
    );
  });

  it('should disable a regional parameter version', async () => {
    const sample = require('../regional_samples/disableRegionalParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId,
      parameterVersionId
    );
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}/versions/${parameterVersionId}`
    );
  });

  it('should enable a parameter version', async () => {
    const sample = require('../enableParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      parameterId,
      parameterVersionId
    );
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/global/parameters/${parameterId}/versions/${parameterVersionId}`
    );
  });

  it('should enable a regional parameter version', async () => {
    const sample = require('../regional_samples/enableRegionalParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId,
      parameterVersionId
    );
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}/versions/${parameterVersionId}`
    );
  });

  it('should delete a parameter version', async () => {
    const sample = require('../deleteParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      parameterId,
      parameterVersionId
    );
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion,
      `projects/${projectId}/locations/global/parameters/${parameterId}/versions/${parameterVersionId}`
    );
  });

  it('should delete a regional parameter version', async () => {
    const sample = require('../regional_samples/deleteRegionalParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId,
      parameterVersionId
    );
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}/versions/${parameterVersionId}`
    );
  });

  it('should delete a parameter', async () => {
    const sample = require('../deleteParam');
    const parameterVersion = await sample.main(projectId, parameterId + '-3');
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion,
      `projects/${projectId}/locations/global/parameters/${parameterId}-3`
    );
  });

  it('should delete a regional parameter', async () => {
    const sample = require('../regional_samples/deleteRegionalParam');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId + '-3'
    );
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}-3`
    );
  });

  it('should create regional parameter version with secret references', async () => {
    const sample = require('../regional_samples/createRegionalParamVersionWithSecret');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId,
      parameterVersionId + '-1',
      regionalSecretVersion.name
    );
    regionalParameterVersionsToDelete.push(parameterVersion.name);
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}/versions/${parameterVersionId}-1`
    );
  });

  it('should create a regional structured parameter', async () => {
    const sample = require('../regional_samples/createStructuredRegionalParam');
    const parameter = await sample.main(
      projectId,
      locationId,
      regionalParameterId + '-1'
    );
    regionalParametersToDelete.push(parameter.name);
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}-1`
    );
  });

  it('should create a regional unstructured parameter', async () => {
    const sample = require('../regional_samples/createRegionalParam');
    const parameter = await sample.main(
      projectId,
      locationId,
      regionalParameterId + '-2'
    );
    regionalParametersToDelete.push(parameter.name);
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}-2`
    );
  });

  it('should create a regional structured parameter version', async () => {
    const sample = require('../regional_samples/createStructuredRegionalParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId + '-1',
      parameterVersionId + '-2',
      jsonPayload
    );
    regionalParameterVersionsToDelete.push(parameterVersion.name);
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}-1/versions/${parameterVersionId}-2`
    );
  });

  it('should create a regional unstructured parameter version', async () => {
    const sample = require('../regional_samples/createRegionalParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId + '-2',
      parameterVersionId + '-3',
      payload
    );
    regionalParameterVersionsToDelete.push(parameterVersion.name);
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}-2/versions/${parameterVersionId}-3`
    );
  });

  it('should list regional parameters', async () => {
    const sample = require('../regional_samples/listRegionalParams');
    const parameters = await sample.main(projectId, locationId);
    assert.exists(parameters);
  });

  it('should get a regional parameter', async () => {
    const sample = require('../regional_samples/getRegionalParam');
    const parameter = await sample.main(
      projectId,
      locationId,
      regionalParameterId
    );
    assert.exists(parameter);
    assert.equal(
      parameter.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}`
    );
  });

  it('should list regional parameter versions', async () => {
    const sample = require('../regional_samples/listRegionalParamVersions');
    const parameterVersions = await sample.main(
      projectId,
      locationId,
      regionalParameterId
    );
    assert.exists(parameterVersions);
  });

  it('should get a regional parameter version', async () => {
    const sample = require('../regional_samples/getRegionalParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId,
      parameterVersionId + '-1'
    );
    assert.exists(parameterVersion);
    assert.equal(
      parameterVersion.name,
      `projects/${projectId}/locations/${locationId}/parameters/${regionalParameterId}/versions/${parameterVersionId}-1`
    );
    assert.equal(parameterVersion.disabled, false);
  });

  it('should render regional parameter version', async () => {
    // Get the current IAM policy.
    const [policy] = await regionalSecretClient.getIamPolicy({
      resource: regionalSecret.name,
    });

    // Add the user with accessor permissions to the bindings list.
    policy.bindings.push({
      role: 'roles/secretmanager.secretAccessor',
      members: [regionalParameter.policyMember.iamPolicyUidPrincipal],
    });

    // Save the updated IAM policy.
    await regionalSecretClient.setIamPolicy({
      resource: regionalSecret.name,
      policy: policy,
    });

    await new Promise(resolve => setTimeout(resolve, 120000));

    const sample = require('../regional_samples/renderRegionalParamVersion');
    const parameterVersion = await sample.main(
      projectId,
      locationId,
      regionalParameterId,
      parameterVersionId + '-1'
    );
    assert.exists(parameterVersion);
  });
});
