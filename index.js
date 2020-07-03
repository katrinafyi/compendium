const fs = require('fs');
const path = require('path');
const process = require('process');

const core = require('@actions/core');
const io = require('@actions/io');
const github = require('@actions/github');
const exec = require('@actions/exec');
const glob = require('@actions/glob');
const tc = require('@actions/tool-cache');
const cache = require('@actions/cache');

const ACTION_DIR = __dirname;
const ELEVENTY_DIR = ACTION_DIR + '/_eleventy';
const DEFAULT_DIR = ACTION_DIR + '/_default';
const TOC_HTML = ACTION_DIR + '/_toc.html';

const WORKSPACE = process.env['GITHUB_WORKSPACE'];
const INPUT_DIR = WORKSPACE + '/' + core.getInput('input-dir');

const CACHE_KEY = 'compendium-cache-key';
const CACHE_PATHS = ['node_modules'];

const PANDOC = 'pandoc';
const PANDOC_VER = '2.10';
const PANDOC_URL = `https://github.com/jgm/pandoc/releases/download/${PANDOC_VER}/pandoc-${PANDOC_VER}-linux-amd64.tar.gz`;

function assertZero(num) {
  if (num != 0) 
    throw new Error('Subprocess exited with non-zero return code!');
}

async function* globRelativeFiles(pattern, base=undefined) {
  if (base === undefined)
    base = process.cwd();
  
  const globber = await glob.create(pattern);
  for await (const file of globber.globGenerator()) {
    if (!fs.lstatSync(file).isFile())
      continue;
    yield path.relative(base, file);
  }
}

(async () => {
  try {
    core.info('Action directory is ' + ACTION_DIR);

    core.startGroup('Initialising pandoc');
    let pandocCache = tc.find(PANDOC, PANDOC_VER);

    if (pandocCache == '') {
      const pandocArchive = await tc.downloadTool(PANDOC_URL);
      const pandocExtracted = await tc.extractTar(pandocArchive);
      core.info('Pandoc downloaded and extracted to ' + pandocExtracted);

      pandocCache = await tc.cacheDir(pandocExtracted, PANDOC, PANDOC_VER);
      core.addPath(pandocCache);
      core.info('Pandoc cached at ' + pandocCache);
    } else {
      core.info('Using existing pandoc cache at ' + pandocCache);
    }
    
    const pandocPaths = await (await glob.create(pandocCache + '/**/' + PANDOC)).glob();
    if (pandocPaths.length == 0)
      throw new Error('Could not find location of pandoc binary');
    const pandoc = pandocPaths[0];
    assertZero(await exec.exec(pandoc + ' --version'));
    core.endGroup();
    
    // if ((await cache.restoreCache(CACHE_PATHS, CACHE_KEY)) === undefined) {
    //   core.info('Creating node_modules cache');
    //   assertZero(await exec.exec('node ci'));
    //   const cache = await cache.saveCache(CACHE_PATHS, CACHE_KEY);
    //   console.info('Cache result ' + cache);
    // } else {
    //   core.info('Using existing node_modules cache');
    // }

    // change to input directory
    core.startGroup('Executing pandoc on pandoc-glob files');
    core.info('Working directory is ' + INPUT_DIR);
    process.chdir(INPUT_DIR);
    
    for await (const file of globRelativeFiles(core.getInput('pandoc-glob'))) {
      const htmlName = file.substr(0, file.lastIndexOf(".")) + ".html";
      const newFile = ELEVENTY_DIR + '/' + htmlName;

      const ret = await exec.exec(pandoc, [
        '-s', '-f', 'markdown', '-t', 'html5', 
        '--katex', '--toc', '--template=' + TOC_HTML,
        file, '-o', newFile,
      ]);
      assertZero(ret);
    }
    core.endGroup();

    const eleventyInput = core.getInput('eleventy-input');
    
    core.startGroup('Copying files from eleventy-input to eleventy directory');
    if (fs.existsSync(eleventyInput) && fs.lstatSync(eleventyInput).isDirectory()) {
      assertZero(
        await exec.exec('cp', ['-rv', eleventyInput + '/*', ELEVENTY_DIR]));
    } else {
      core.info('Invalid eleventy-input directory, ignoring');
    }
    core.endGroup();

    core.startGroup('Generating site with eleventy');
    process.chdir(ELEVENTY_DIR);
    core.info('Executing eleventy');
    assertZero(await exec.exec(ACTION_DIR + '/node_modules/.bin/eleventy')); // hack
    core.endGroup();

    const sitePath = ELEVENTY_DIR + '/_site';

    core.startGroup('Copying files from copy-glob to generated site folder');
    process.chdir(INPUT_DIR);
    for await (const file of globRelativeFiles(core.getInput('copy-glob'))) {
      const newFile = sitePath + '/' + file;
      const newDir = path.dirname(newFile);
      
      await io.mkdirP(newDir);
      await io.cp(file, newFile, {force: true, recursive: true});
    }
    core.endGroup();

    core.setOutput('site', path.relative(WORKSPACE, sitePath));

  } catch (error) {
    core.setFailed(error.message);
  }
})();