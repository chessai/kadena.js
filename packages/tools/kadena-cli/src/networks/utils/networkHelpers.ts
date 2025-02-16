import {
  defaultNetworksPath,
  networkDefaults,
  networkFiles,
} from '../../constants/networks.js';

import {
  formatZodError,
  mergeConfigs,
  sanitizeFilename,
} from '../../utils/helpers.js';

import yaml from 'js-yaml';
import path from 'path';
import { z } from 'zod';
import { services } from '../../services/index.js';

export interface ICustomNetworkChoice {
  value: string; // | typeof skipSymbol | typeof createSymbol;
  name?: string;
  description?: string;
  disabled?: boolean | string;
}

export interface INetworkCreateOptions {
  network: string;
  networkId: string;
  networkHost: string;
  networkExplorerUrl: string;
}

export interface INetworksCreateOptions {
  network: string;
  networkId: string;
  networkHost: string;
  networkExplorerUrl: string;
}

const networkSchema = z.object({
  network: z.string(),
  networkId: z.string(),
  networkHost: z.string().url(),
  networkExplorerUrl: z.string().optional(),
});

/**
 * Writes the given network setting to the networks folder
 *
 * @param {TNetworksCreateOptions} options - The set of configuration options.
 * @param {string} options.network - The network (e.g., 'mainnet', 'testnet') or custom network.
 * @param {string} options.networkId - The ID representing the network.
 * @param {string} options.networkHost - The hostname for the network.
 * @param {string} options.networkExplorerUrl - The URL for the network explorer.
 * @returns {void} - No return value; the function writes directly to a file.
 */
export async function writeNetworks(
  options: INetworkCreateOptions,
): Promise<void> {
  const { network } = options;
  const sanitizedNetwork = sanitizeFilename(network).toLowerCase();
  const networkFilePath = path.join(
    defaultNetworksPath,
    `${sanitizedNetwork}.yaml`,
  );

  let existingConfig: INetworkCreateOptions =
    typeof networkDefaults[network] !== 'undefined'
      ? { ...networkDefaults[network] }
      : { ...networkDefaults.other };

  if (await services.filesystem.fileExists(networkFilePath)) {
    const content = await services.filesystem.readFile(networkFilePath);
    if (content !== null) {
      existingConfig = yaml.load(content!) as INetworkCreateOptions;
    }
  }

  const networkConfig = mergeConfigs(existingConfig, options);

  await services.filesystem.ensureDirectoryExists(networkFilePath);

  const parsed = networkSchema.safeParse(networkConfig);

  if (!parsed.success) {
    throw new Error(
      `Failed to write network config: ${formatZodError(parsed.error)}`,
    );
  }

  await services.filesystem.writeFile(
    networkFilePath,
    yaml.dump(networkConfig),
  );
}

/**
 * Removes the given network setting from the networks folder
 *
 * @param {Pick<INetworkCreateOptions, 'network'>} options - The set of configuration options.
 * @param {string} options.network - The network (e.g., 'mainnet', 'testnet') or custom network.
 */
export async function removeNetwork(
  options: Pick<INetworkCreateOptions, 'network'>,
): Promise<void> {
  const { network } = options;
  const sanitizedNetwork = sanitizeFilename(network).toLowerCase();
  const networkFilePath = path.join(
    defaultNetworksPath,
    `${sanitizedNetwork}.yaml`,
  );

  await services.filesystem.deleteFile(networkFilePath);
}

export async function loadNetworkConfig(
  network: string,
): Promise<INetworksCreateOptions> {
  const networkFilePath = path.join(defaultNetworksPath, `${network}.yaml`);

  const file = await services.filesystem.readFile(networkFilePath);
  if (file === null) {
    throw new Error('Network configuration file not found.');
  }

  return yaml.load(file) as INetworksCreateOptions;
}

export async function ensureNetworksConfiguration(): Promise<void> {
  await services.filesystem.ensureDirectoryExists(defaultNetworksPath);

  for (const [network, filePath] of Object.entries(networkFiles)) {
    if (!(await services.filesystem.fileExists(filePath))) {
      await writeNetworks(networkDefaults[network]);
    }
  }
}
