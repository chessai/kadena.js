import yaml from 'js-yaml';
import path from 'node:path';
import sanitize from 'sanitize-filename';
import { WALLET_DIR, YAML_EXT } from '../../constants/config.js';
import {
  detectArrayFileParseType,
  notEmpty,
  safeJsonParse,
  safeYamlParse,
} from '../../utils/helpers.js';
import { relativeToCwd } from '../../utils/path.util.js';
import type { Services } from '../index.js';
import {
  WALLET_SCHEMA_VERSION,
  walletSchema,
} from '../wallet/wallet.schemas.js';
import type {
  IWallet,
  IWalletCreate,
  IWalletFile,
} from '../wallet/wallet.types.js';
import { plainKeySchema } from './config.schemas.js';
import type {
  IPlainKey,
  IPlainKeyCreate,
  IPlainKeyFile,
} from './config.types.js';

export interface IConfigService {
  // Key
  getPlainKey(filepath: string): Promise<IPlainKey | null>;
  getPlainKeys(directory?: string): Promise<IPlainKey[]>;
  setPlainKey(key: IPlainKeyCreate): Promise<string>;
  // wallet
  getWallet: (filepath: string) => Promise<IWallet | null>;
  setWallet: (wallet: IWalletCreate) => Promise<string>;
  getWallets: () => Promise<IWallet[]>;
  deleteWallet: (filepath: string) => Promise<void>;
}

export class ConfigService implements IConfigService {
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/parameter-properties
  public constructor(private services: Services) {}

  public async getPlainKey(
    filepath: string,
    /* How to parse file, defaults to yaml */
    type?: 'yaml' | 'json',
  ): ReturnType<IConfigService['getPlainKey']> {
    const file = await this.services.filesystem.readFile(filepath);
    if (file === null) return null;

    const parser = type === 'json' ? safeJsonParse : safeYamlParse;
    const parsed = plainKeySchema.safeParse(parser(file));
    if (!parsed.success) return null;

    const alias = path.basename(filepath);
    return {
      alias: alias,
      filepath,
      legacy: parsed.data.legacy ?? false,
      publicKey: parsed.data.publicKey,
      secretKey: parsed.data.secretKey,
    };
  }

  public async getPlainKeys(
    directory?: string,
  ): ReturnType<IConfigService['getPlainKeys']> {
    const dir = directory ?? process.cwd();
    const files = await this.services.filesystem.readDir(dir);
    const filepaths = files.map((file) => path.join(dir, file));
    const parsableFiles = detectArrayFileParseType(filepaths);
    const keys = await Promise.all(
      parsableFiles.map(async (file) =>
        this.getPlainKey(file.filepath, file.type),
      ),
    );
    return keys.filter(notEmpty);
  }

  public async setPlainKey(
    key: IPlainKeyCreate,
  ): ReturnType<IConfigService['setPlainKey']> {
    const filename = sanitize(key.alias);
    const filepath = path.join(process.cwd(), `${filename}${YAML_EXT}`);
    if (await this.services.filesystem.fileExists(filepath)) {
      throw new Error(`Plain Key "${relativeToCwd(filepath)}" already exists.`);
    }
    const data: IPlainKeyFile = {
      publicKey: key.publicKey,
      secretKey: key.secretKey,
    };
    if (key.legacy) data.legacy = key.legacy;
    await this.services.filesystem.writeFile(
      filepath,
      yaml.dump(data, { lineWidth: -1 }),
    );
    return filepath;
  }

  public async getWallet(
    filepath: string,
  ): ReturnType<IConfigService['getWallet']> {
    const file = await this.services.filesystem.readFile(filepath);
    if (file === null) {
      throw new Error(`Wallet file "${relativeToCwd(filepath)}" not found.`);
    }
    const parsed = walletSchema.safeParse(safeYamlParse(file));
    if (!parsed.success) return null;
    return {
      alias: parsed.data.alias,
      filepath,
      version: parsed.data.version,
      legacy: parsed.data.legacy ?? false,
      mnemonic: parsed.data.mnemonic,
      keys: parsed.data.keys,
    };
  }

  public async setWallet(
    wallet: IWalletCreate,
  ): ReturnType<IConfigService['setWallet']> {
    const filename = sanitize(wallet.alias);
    const filepath = path.join(process.cwd(), `${filename}${YAML_EXT}`);
    if (await this.services.filesystem.fileExists(filepath)) {
      throw new Error(`Wallet "${relativeToCwd(filepath)}" already exists.`);
    }
    const data: IWalletFile = {
      alias: wallet.alias,
      legacy: wallet.legacy ?? false,
      mnemonic: wallet.mnemonic,
      version: WALLET_SCHEMA_VERSION,
      keys: [],
    };
    await this.services.filesystem.writeFile(
      filepath,
      yaml.dump(data, { lineWidth: -1 }),
    );
    return filepath;
  }

  public async getWallets(): ReturnType<IConfigService['getWallets']> {
    const files = await this.services.filesystem.readDir(WALLET_DIR);
    const filepaths = files.map((file) => path.join(WALLET_DIR, file));
    const wallets = await Promise.all(
      filepaths.map(async (filepath) => this.getWallet(filepath)),
    );
    return wallets.filter(notEmpty);
  }

  public async deleteWallet(
    filepath: string,
  ): ReturnType<IConfigService['deleteWallet']> {
    await this.services.filesystem.deleteFile(filepath);
  }
}
