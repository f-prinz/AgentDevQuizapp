import { spawn } from 'node:child_process';
import { access, mkdtemp, mkdir, open, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const postgresBin = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
const temporaryRoot = path.resolve(helperDirectory, '..', '..', 'tmp');

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    throw new Error('Could not allocate a local PostgreSQL test port.');
  }

  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function logTail(logPath: string): Promise<string> {
  try {
    const lines = (await readFile(logPath, 'utf8')).split(/\r?\n/).filter(Boolean);
    const tail = lines.slice(-12).join('\n').slice(-1600);
    return tail ? `\nPostgreSQL tool log tail:\n${tail}` : '\nPostgreSQL tool log is empty.';
  } catch {
    return '\nPostgreSQL tool log could not be read.';
  }
}

async function runPostgresTool(executable: string, args: string[], logPath: string): Promise<void> {
  const toolName = path.basename(executable);
  const logFile = await open(logPath, 'a');

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', logFile.fd, logFile.fd] });
      let settled = false;

      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };

      const timeout = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // Cleanup below will use the owned data directory if PostgreSQL started.
        }
        void logTail(logPath).then(tail => {
          finish(new Error(`The isolated PostgreSQL test command timed out: ${toolName}.${tail}`));
        });
      }, 120_000);

      child.once('error', error => {
        const code = 'code' in error ? error.code : undefined;
        void logTail(logPath).then(tail => {
          finish(new Error(`Could not start the isolated PostgreSQL test command ${toolName} (code ${code ?? 'unknown'}).${tail}`));
        });
      });

      child.once('exit', (code, signal) => {
        if (code === 0) {
          finish();
          return;
        }

        const status = code === null ? `signal ${signal ?? 'unknown'}` : `exit code ${code}`;
        void logTail(logPath).then(tail => {
          finish(new Error(`The isolated PostgreSQL test command ${toolName} failed with ${status}.${tail}`));
        });
      });
    });
  } finally {
    await logFile.close();
  }
}

export interface EphemeralPostgres {
  connectionString: string;
  stop(): Promise<void>;
}

export async function startEphemeralPostgres(): Promise<EphemeralPostgres> {
  await mkdir(temporaryRoot, { recursive: true });
  const dataDirectory = await mkdtemp(path.join(temporaryRoot, 'tech4-pg-'));
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedDataDirectory = path.resolve(dataDirectory);
  const isOwnedTestDirectory = path.dirname(resolvedDataDirectory) === resolvedTemporaryRoot
    && path.basename(resolvedDataDirectory).startsWith('tech4-pg-');

  if (!isOwnedTestDirectory) {
    throw new Error('Refusing to use a PostgreSQL test directory outside apps/server/tmp.');
  }

  const dataPath = path.join(resolvedDataDirectory, 'data');
  const logPath = path.join(resolvedDataDirectory, 'postgres.log');
  const toolLogPath = path.join(resolvedDataDirectory, 'postgres-tools.log');
  const postmasterPidPath = path.join(dataPath, 'postmaster.pid');
  const port = await availablePort();
  let startAttempted = false;
  let stopped = false;

  const stop = async (): Promise<void> => {
    if (stopped) return;

    const absoluteDataDirectory = path.resolve(dataDirectory);
    const isAbsoluteOwnedDescendant = absoluteDataDirectory.startsWith(`${resolvedTemporaryRoot}${path.sep}`)
      && path.dirname(absoluteDataDirectory) === resolvedTemporaryRoot
      && path.basename(absoluteDataDirectory).startsWith('tech4-pg-');
    if (!isOwnedTestDirectory || !isAbsoluteOwnedDescendant) {
      throw new Error('Refusing to remove a path outside apps/server/tmp.');
    }

    if (startAttempted) {
      let postmasterExists = false;
      try {
        await access(postmasterPidPath);
        postmasterExists = true;
      } catch (error) {
        if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'ENOENT') {
          throw error;
        }
      }

      if (postmasterExists) {
        try {
          await runPostgresTool(path.join(postgresBin, 'pg_ctl.exe'), [
            '-D', dataPath,
            '-m', 'fast',
            '-w', 'stop',
          ], toolLogPath);
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'unknown PostgreSQL stop failure';
          throw new Error(`Could not stop the owned PostgreSQL test cluster; its data was preserved at ${resolvedDataDirectory}. ${detail}`, { cause: error });
        }
      }
    }

    await rm(resolvedDataDirectory, { recursive: true, force: true });
    stopped = true;
  };

  try {
    await runPostgresTool(path.join(postgresBin, 'initdb.exe'), [
      '-D', dataPath,
      '-A', 'trust',
      '-U', 'raccoons_test',
      '-E', 'UTF8',
      '--no-locale',
    ], toolLogPath);

    startAttempted = true;
    await runPostgresTool(path.join(postgresBin, 'pg_ctl.exe'), [
      '-D', dataPath,
      '-l', logPath,
      '-o', `-h 127.0.0.1 -p ${port} -c listen_addresses=127.0.0.1`,
      '-w', 'start',
    ], toolLogPath);
    return {
      connectionString: `postgresql://raccoons_test@127.0.0.1:${port}/postgres`,
      stop,
    };
  } catch (error) {
    try {
      await stop();
    } catch (cleanupError) {
      const setupDetail = error instanceof Error ? error.message : 'unknown PostgreSQL setup failure';
      const cleanupDetail = cleanupError instanceof Error ? cleanupError.message : 'unknown PostgreSQL cleanup failure';
      throw new Error(`PostgreSQL test setup failed and cleanup could not stop the owned cluster; data was preserved at ${resolvedDataDirectory}. ${setupDetail} ${cleanupDetail}`, { cause: cleanupError });
    }
    throw error;
  }
}
