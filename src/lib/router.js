// Bridge between vanilla main.js and Vue Router. Will go away once main.js
// is fully migrated and components use `useRouter()` directly.
//
// Route metadata, parsing, and link helpers live in `app/router.ts`.

let navigateWithRouter = null;

export function setNavigator(navigateImplementation) {
  navigateWithRouter = typeof navigateImplementation === "function" ? navigateImplementation : null;
}

export function navigate(pathname, { replace = false } = {}) {
  if (navigateWithRouter) {
    return navigateWithRouter(pathname, { replace });
  }

  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", pathname);
  window.dispatchEvent(new CustomEvent("selenwright:navigate"));
}
