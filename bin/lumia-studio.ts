#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { loadEnvFileIfPresent } from '@lumia/api/config';
import { readDeployConfig } from '../lib/deploy-config';
import { repoPath } from '../lib/paths';
import { createStudioApp } from '../lib/studio-app';

// Settings of this deployment; another account only changes the values in .env (see .env.example).
loadEnvFileIfPresent(pathToFileURL(repoPath('.env')));
createStudioApp(readDeployConfig(process.env));
