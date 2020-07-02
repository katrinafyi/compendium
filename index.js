const fs = require('fs');
const path = require('path');
const process = require('process');

const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');
const glob = require('@actions/glob');
const tc = require('@actions/tool-cache');
const cache = require('@actions/cache');

const ACTION_DIR = __dirname;
const ELEVENTY_DIR = ACTION_DIR + '/_eleventy';
const TOC_HTML = ACTION_DIR + '/_toc.html';

const WORKSPACE = process.env['GITHUB_WORKSPACE'];
const INPUT_DIR = WORKSPACE + '/' + core.getInput('input-dir');

const CACHE_KEY = 'compendium-cache-key';
const CACHE_PATHS = ['node_modules'];

const PANDOC = 'https://github.com/jgm/pandoc/releases/download/2.10/pandoc-2.10-linux-amd64.tar.gz';


function assertZero(num) {
  if (num != 0) 
    throw new Error('Pandoc installed improperly!');
}

(async () => {
  try {
    core.info('Action directory is ' + ACTION_DIR);
    
    const pandocArchive = await tc.downloadTool(PANDOC);
    const pandocExtracted = await tc.extractTar(pandocArchive);
    core.info('Pandoc downloaded and extracted to ' + pandocExtracted);

    const pandocCache = await tc.cacheDir(pandocExtracted, 'pandoc', '2.10');
    core.addPath(pandocCache);
    core.info('Pandoc cached at ' + pandocCache);

    
    const pandocPaths = await (await glob.create(pandocCache + '/**/pandoc')).glob();
    if (pandocPaths.length == 0)
      throw new Error('Could not find location of pandoc binary');
    const pandoc = pandocPaths[0];
    assertZero(await exec.exec(pandoc + ' --version'));
    
    // if ((await cache.restoreCache(CACHE_PATHS, CACHE_KEY)) === undefined) {
    //   core.info('Creating node_modules cache');
    //   assertZero(await exec.exec('node ci'));
    //   const cache = await cache.saveCache(CACHE_PATHS, CACHE_KEY);
    //   console.info('Cache result ' + cache);
    // } else {
    //   core.info('Using existing node_modules cache');
    // }

    // change to input directory
    core.info('Working directory is ' + INPUT_DIR);
    process.chdir(INPUT_DIR);

    const globber = await glob.create(core.getInput('input-glob'));
    for await (let file of globber.globGenerator()) {
      if (!fs.lstatSync(file).isFile()) continue;

      file = path.relative(INPUT_DIR, file);

      const htmlName = file.substr(0, file.lastIndexOf(".")) + ".html";
      const newFile = ELEVENTY_DIR + '/' + htmlName;
      core.info('Converting input file ' + file + ' to ' + newFile);

      const ret = await exec.exec(pandoc, [
        '-s', '-f', 'markdown', '-t', 'html5', 
        '--katex', '--toc', '--template=' + TOC_HTML,
        file, '-o', newFile,
      ]);
      assertZero(ret);
    }

    process.chdir(ELEVENTY_DIR);
    core.info('Executing eleventy');
    assertZero(await exec.exec('eleventy'));

    process.chdir(INPUT_DIR);
    const globber2 = await glob.create(core.getInput('copy-glob'));
    for await (let file of globber2.globGenerator()) {
      file = path.relative(file, INPUT_DIR);

      core.info('Copying ' + file + ' to ' + ELEVENTY_DIR + file);
      assertZero(await exec.exec('cp', ['-rv', file, ELEVENTY_DIR + file]));
    }
  } catch (error) {
    core.setFailed(error.message);
  }
})();