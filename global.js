console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
} 

let navlinks = $$("nav a");

let currentLink = navLinks.find(
    (a) => a.host === location.host && a.pathname === location.pathname,
  );


  if (currentLink) {
    // or if currentLink is undefined
    currentLink.classList.add("current")
  }