module.exports = function(eleventyConfig) {
  // Copy static assets
  eleventyConfig.addPassthroughCopy('src/css');
  eleventyConfig.addPassthroughCopy('src/js');
  eleventyConfig.addPassthroughCopy('src/images');
  eleventyConfig.addPassthroughCopy('src/robots.txt');
  eleventyConfig.addPassthroughCopy({ 'src/sw.js': 'sw.js' });
  eleventyConfig.addPassthroughCopy({ 'src/manifest.json': 'manifest.json' });

  // Watch for changes
  eleventyConfig.addWatchTarget('src/css/');
  eleventyConfig.addWatchTarget('src/js/');

  // Add filter for age calculation from birthday date (YYYY-MM-DD)
  eleventyConfig.addFilter('calculateAge', function(birthday) {
    if (!birthday) return null;

    const birthDate = new Date(birthday);
    const today = new Date();

    // Don't calculate age for future dates
    if (birthDate > today) return null;

    // Calculate years and months
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();

    // If we haven't reached the birth day this month, subtract a month
    if (today.getDate() < birthDate.getDate()) {
      months--;
    }

    // If months is negative, we haven't reached the birth month this year
    if (months < 0) {
      years--;
      months += 12;
    }

    // Check if it's the dog's birthday today
    const isBirthday = today.getMonth() === birthDate.getMonth() &&
                       today.getDate() === birthDate.getDate();

    // Calculate total months for dogs under 1 year
    const totalMonths = years * 12 + months;

    return {
      years,
      months,
      totalMonths,
      isBirthday
    };
  });

  // Add filter to prefix image URL with API URL
  eleventyConfig.addFilter('imageUrl', function(url) {
    if (!url) return '/images/placeholder.png';
    const API_URL = process.env.API_URL || 'http://localhost:3000';
    return API_URL + url;
  });

  // Add filter to get featured photo
  eleventyConfig.addFilter('getFeaturedPhoto', function(dog) {
    const API_URL = process.env.API_URL || 'http://localhost:3000';

    // No photos at all - use placeholder
    if (!dog.photos || dog.photos.length === 0) {
      return '/images/placeholder.png';
    }

    // Try to find featured photo
    const featured = dog.photos.find(p => p.isFeatured);
    if (featured?.file?.url) {
      return API_URL + featured.file.url;
    }

    // Fall back to first photo
    if (dog.photos[0]?.file?.url) {
      return API_URL + dog.photos[0].file.url;
    }

    // No valid photos - use placeholder
    return '/images/placeholder.png';
  });

  // Add filter to get edit URL for a dog
  eleventyConfig.addFilter('editUrl', function(dogId) {
    const API_URL = process.env.API_URL || 'http://localhost:3000';
    return `${API_URL}/dogs/${dogId}`;
  });

  // Add global metadata
  eleventyConfig.addGlobalData('metadata', {
    url: process.env.SITE_URL || 'http://localhost:8080',
    apiUrl: process.env.API_URL || 'http://localhost:3000'
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
                owner {
                  name
                  email
                  phone
                }
                photos(where: { status: { equals: approved } }) {
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
