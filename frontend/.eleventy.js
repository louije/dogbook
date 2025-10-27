module.exports = function(eleventyConfig) {
  // Copy static assets
  eleventyConfig.addPassthroughCopy('src/css');
  eleventyConfig.addPassthroughCopy('src/js');
  eleventyConfig.addPassthroughCopy('src/images');
  eleventyConfig.addPassthroughCopy('src/robots.txt');

  // Watch for changes
  eleventyConfig.addWatchTarget('src/css/');
  eleventyConfig.addWatchTarget('src/js/');

  // Add filter for age calculation
  eleventyConfig.addFilter('calculateAge', function(birthYear) {
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  });

  // Add filter to prefix image URL with API URL
  eleventyConfig.addFilter('imageUrl', function(url) {
    if (!url) return '/images/placeholder-dog.jpg';
    const API_URL = process.env.API_URL || 'http://localhost:3000';
    return API_URL + url;
  });

  // Add filter to get featured photo
  eleventyConfig.addFilter('getFeaturedPhoto', function(dog) {
    const API_URL = process.env.API_URL || 'http://localhost:3000';

    if (dog.photoFeatured?.url) {
      return API_URL + dog.photoFeatured.url;
    }
    // If no featured photo, use first photo from media
    if (dog.photos && dog.photos.length > 0) {
      const featured = dog.photos.find(p => p.isFeatured);
      if (featured?.file?.url) return API_URL + featured.file.url;
      if (dog.photos[0]?.file?.url) return API_URL + dog.photos[0].file.url;
    }
    return '/images/placeholder-dog.jpg';
  });

  // Add global metadata
  eleventyConfig.addGlobalData('metadata', {
    url: process.env.SITE_URL || 'http://localhost:8080'
  });

  // Fetch data from Keystone API
  eleventyConfig.addGlobalData('dogs', async () => {
    const API_URL = process.env.API_URL || 'http://localhost:3000';

    try {
      const response = await fetch(`${API_URL}/api/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              dogs {
                id
                name
                sex
                birthday
                breed
                coat
                description {
                  document
                }
                photoFeatured {
                  url
                  width
                  height
                }
                owner {
                  name
                  email
                  phone
                }
                photos {
                  id
                  name
                  type
                  videoUrl
                  isFeatured
                  file {
                    url
                    width
                    height
                  }
                }
              }
            }
          `
        })
      });

      const data = await response.json();
      return data.data?.dogs || [];
    } catch (error) {
      console.error('Error fetching dogs:', error);
      return [];
    }
  });

  // Fetch owners
  eleventyConfig.addGlobalData('owners', async () => {
    const API_URL = process.env.API_URL || 'http://localhost:3000';

    try {
      const response = await fetch(`${API_URL}/api/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query {
              owners {
                id
                name
                email
                phone
                dogs {
                  id
                  name
                }
              }
            }
          `
        })
      });

      const data = await response.json();
      return data.data?.owners || [];
    } catch (error) {
      console.error('Error fetching owners:', error);
      return [];
    }
  });

  return {
    dir: {
      input: 'src',
      output: '_site',
      includes: '_includes',
      layouts: '_layouts'
    },
    templateFormats: ['md', 'njk', 'html'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk'
  };
};
