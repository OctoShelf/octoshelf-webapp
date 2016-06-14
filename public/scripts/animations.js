/**
 * Animations - Animations are in charge of... animating, things. These functions
 * are generally self-contained and don't have any impact on the app state.
 */

const stylesheetHelper = document.createElement("style");
const appBackground = document.getElementById('appBackground');
const repoSection = document.getElementById('repoSection');

const inputWrapperSize = 130;
const bubbleSize = 150;
let centerDistance = 0;

/**
 * Update Bubble Styles by injecting new css rules
 * @param {Element} appElement - core OctoShelf app element
 */
function updateBubbleStyles(appElement) {
  let {innerHeight, innerWidth} = window;
  let modifiedHeight = innerHeight - 40;
  let bubbleModify = bubbleSize / 2;
  let top = (innerHeight / 2) - bubbleModify - 40;
  let left = (innerWidth / 2) - bubbleModify;

  let hDistance = (modifiedHeight / 2) - (bubbleSize * 2 / 3);
  let wDistance = (innerWidth / 2) - (bubbleSize * 2 / 3);
  centerDistance = hDistance < wDistance ? hDistance : wDistance;

  while (stylesheetHelper.sheet.cssRules.length) {
    if (stylesheetHelper.sheet.removeRule) {
      stylesheetHelper.sheet.removeRule(0);
    } else if (stylesheetHelper.sheet.deleteRule) {
      stylesheetHelper.sheet.deleteRule(0);
    }
  }
  let size = bubbleSize;
  let dims = ['height', 'width'].map(prop => prop + `:${size}px`).join(';');
  let pos = `top:${top}px;left:${left}px;`;
  let wrapSelector = '.app-prompt, .app-repositoriesWrapper';
  let wrapRule = `transition: all .5s ease;${pos};${dims}`;

  let afterHeight = centerDistance - (bubbleSize / 2);
  let afterRule = `top: ${size}px;height:${afterHeight}px`;

  stylesheetHelper.sheet.insertRule(`${wrapSelector} {${wrapRule}}`, 0);
  stylesheetHelper.sheet.insertRule(`.bubble {${dims}}`, 0);
  stylesheetHelper.sheet.insertRule(`.repository:after {${afterRule}}`, 0);

  let toggleInline = innerHeight < 550 || innerWidth < 500;
  appElement.classList.toggle('octoInline', toggleInline);

  updateRotations();
}

/**
 * Github's Prefix is dynamic. To account for corp github urls,
 * when the page loads we auto resize the font-size to make sure it fits
 */
function resizeGitubPrefix() {
  let prefix = document.querySelector('.addRepoInput-prefix');
  let prefixWidth = prefix.scrollWidth;
  let sizeRatio = ~~((inputWrapperSize / (prefixWidth + 10)) * 100) / 100;
  let fontSize = sizeRatio < 1 ? sizeRatio : 1;
  prefix.style.fontSize = `${fontSize}rem`;
}

/**
 * Lazy Load a sweet background image into focus.
 *
 * We start off with a low-res blurred image on the `body` tag that gets loaded
 * very quickly. We then load a high-res background image to an empty `img` tag.
 * Once the image has finished loading, we insert the image as a background to
 * an empty div that has blur(10px), and slowly animate away that blur to 0.
 */
function lazyLoadBackground() {
  let img = document.createElement('img');
  let imgSrc = '/images/background.jpg';
  let now = Date.now();
  img.setAttribute('src', imgSrc);

  img.onload = function() {
    appBackground.style.backgroundImage = `url(${imgSrc})`;
    let loadTime = Date.now() - now;

    /**
     * If the loadTime is less than 100ms, the background was likely cached.
     * Slowly unbluring the background is a cool nice animation, but if they've
     * seen it once before, we should limit the duration of the blurry state.
     */
    if (loadTime < 1000) {
      return appBackground.classList.add('loaded');
    }

    setTimeout(() => {
      appBackground.classList.add('loaded');
    }, 1000);
  };
}

/**
 * Update the rotation of the different repo bubbles
 */
export function updateRotations() {
  let count = repoSection.childElementCount;
  let rotation = 360 / count;
  let current = 0;

  let child = repoSection.firstElementChild;
  while (child) {
    let rotateBy = current * rotation;
    let transform = `rotate(${rotateBy}deg) translateY(-${centerDistance}px)`;
    let innerTransform = `transform: rotate(-${rotateBy}deg);`;

    child.style.cssText = `transform: ${transform};`;
    child.firstElementChild.style.cssText = innerTransform;
    current++;
    child = child.nextElementSibling;
  }
}

/**
 * Load initial animations and any animation specific event handlers
 * @param {Element} appElement - core OctoShelf element
 */
export function loadAnimations(appElement) {
  document.head.appendChild(stylesheetHelper);
  lazyLoadBackground();
  updateBubbleStyles(appElement);
  resizeGitubPrefix();

  let resizeDebounce;
  window.addEventListener('resize', function() {
    if (resizeDebounce) {
      clearTimeout(resizeDebounce);
    }

    resizeDebounce = setTimeout(() => {
      updateBubbleStyles(appElement);
    }, 30);
  });
}
