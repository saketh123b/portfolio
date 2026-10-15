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

let pages = [
    {url: "", title: "Home"},
    {url: "resume", title: "Resume"},
    {url: "projects", title: "Projects"},
    {url: "contacts", title: "Contacts"}
]

let nav = document.createElement("nav");
document.body.prepend(nav);

for (let p of pages) {
    let url = p.url;
    let title = p.title;
    // next step: create link and add it to nav
    let link = document.createElement("a");
    link.href = url;
    link.textContent = title;
    nav.appendChild(link);

}

// create link and add it to nav
nav.insertAdjacentHTML("beforeend", `<a href="${url}">${title}</a>`)