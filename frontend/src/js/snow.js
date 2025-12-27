/**
 * PureSnow - Snowfall effect
 * Based on https://github.com/superawdi/puresnowjs
 * Modified to be controllable (start/stop)
 */

var PureSnow = (function() {
  'use strict';

  var styleElement = null;
  var snowContainer = null;

  function getSnowflakeCount() {
    // Fewer snowflakes on small screens for performance
    return window.innerWidth < 768 ? 25 : 150;
  }

  function randomInt(value) {
    return Math.floor(Math.random() * value) + 1;
  }

  function randomRange(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function createSnowContainer() {
    var container = document.createElement('div');
    container.id = 'snow';
    container.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 50; overflow: hidden; will-change: transform; transform: translateZ(0);';
    document.body.appendChild(container);
    return container;
  }

  function spawnSnow(container, count) {
    for (var x = 0; x < count - 1; x++) {
      var flake = document.createElement('div');
      flake.className = 'snowflake';
      container.appendChild(flake);
    }
  }

  function addCss(rule) {
    var css = document.createElement('style');
    css.type = 'text/css';
    css.appendChild(document.createTextNode(rule));
    document.head.appendChild(css);
    return css;
  }

  function generateSnowCSS(count) {
    var bodyHeightPx = Math.max(document.body.offsetHeight, window.innerHeight);
    var pageHeightVH = (100 * bodyHeightPx / window.innerHeight);

    var baseCss = '.snowflake { position: absolute; width: 8px; height: 8px; background: white; border-radius: 50%; filter: drop-shadow(0 0 8px white); will-change: transform; }';

    var rule = baseCss;

    for (var i = 1; i < count; i++) {
      var randomX = Math.random() * 100;
      var randomOffset = randomRange(-100000, 100000) * 0.0001;
      var randomXEnd = randomX + randomOffset;
      var randomXEndYoyo = randomX + (randomOffset / 2);
      var randomYoyoTime = randomRange(30000, 80000) / 100000;
      var randomYoyoY = randomYoyoTime * pageHeightVH;
      var randomScale = Math.random();
      var fallDuration = randomRange(10, Math.max(15, pageHeightVH / 10 * 3));
      var fallDelay = randomInt(Math.max(10, pageHeightVH / 10 * 3)) * -1;
      var opacity = Math.random() * 0.7 + 0.3;

      rule += '\n.snowflake:nth-child(' + i + ') { opacity: ' + opacity + '; transform: translate(' + randomX + 'vw, -10px) scale(' + randomScale + '); animation: fall-' + i + ' ' + fallDuration + 's ' + fallDelay + 's linear infinite; }';
      rule += '\n@keyframes fall-' + i + ' { ' + (randomYoyoTime * 100) + '% { transform: translate(' + randomXEnd + 'vw, ' + randomYoyoY + 'vh) scale(' + randomScale + '); } to { transform: translate(' + randomXEndYoyo + 'vw, ' + pageHeightVH + 'vh) scale(' + randomScale + '); } }';
    }

    return rule;
  }

  return {
    start: function() {
      // Remove any existing snow
      this.stop();

      var count = getSnowflakeCount();

      // Create container
      snowContainer = createSnowContainer();

      // Generate and add CSS
      var css = generateSnowCSS(count);
      styleElement = addCss(css);

      // Spawn snowflakes
      spawnSnow(snowContainer, count);

      return this;
    },

    stop: function() {
      if (snowContainer && snowContainer.parentNode) {
        snowContainer.parentNode.removeChild(snowContainer);
        snowContainer = null;
      }
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
        styleElement = null;
      }
    }
  };
})();
