import os
import glob
import shutil
import zipfile
import subprocess 

if __name__ == "__main__":

    # pandoc -f markdown -t html Revision.md --mathjax
    for f in glob.glob('./*.md'):
        d = os.path.dirname(f)
        fn = os.path.basename(f).replace('.md', '.html')
        subprocess.check_call([
            'pandoc', 
            '-s',
            # '--lua-filter', '_fix_img.lua', 
            '-f', 'markdown', '-t', 'html5', 
            # '--mathjax',
            '--katex', 
            '--toc',
            '--template=_toc.html',
            f,
            '-o', d+'/output/'+fn,
        ], shell=True)

    os.chdir('output')
    shutil.rmtree('_site', ignore_errors=True)
    subprocess.check_call(['npx', 'eleventy'], shell=True)
    os.chdir('_site')
    with zipfile.ZipFile('../_render_site.zip', 'w') as z:
        for d, dirs, files in os.walk('.'):
            for f in files:
                z.write(os.path.join(d, f))
