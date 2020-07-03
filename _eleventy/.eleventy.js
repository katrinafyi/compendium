const toc = require('eleventy-plugin-nesting-toc');

function compare(a, b) {
    const left = a.url.replace(/ (\d) /g, ' 0$1 ');
    const right = b.url.replace(/ (\d) /g, ' 0$1 ');
    return left.localeCompare(right);
}

module.exports = function(eleventyConfig) {
    eleventyConfig.addPlugin(toc, 
        { headingText: 'Table of Contents', tags: ['h1', 'h2', 'h3', 'h4'] });

    // Output directory: _site
    eleventyConfig.addPassthroughCopy("assets");

    eleventyConfig.addFilter('sortNumeric', function(pages) {
        return Array.from(pages).sort(compare);
    });

    eleventyConfig.addFilter('fixImg', function(data) {
        return data.replace(/="assets\//g, '="/assets/');
    });

    eleventyConfig.addFilter('withoutTag', function(pages, tag) {
        return (pages || []).filter(p => !p.data.tags.includes(tag));
    });

    eleventyConfig.addCollection("list", function(collectionApi) {
        return collectionApi.getAll()
        .filter(item => !item.data.single_page_exclude)
        .sort(compare);
    });

    eleventyConfig.addShortcode("date", function() {
        return (new Date()).toLocaleDateString();
    })
};