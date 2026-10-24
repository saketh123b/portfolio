console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// ---------- Step 3: navigation menu ----------
const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/'
    : '/portfolio/'; // must match your repo name exactly

let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'resume/', title: 'Resume' },
  { url: 'contacts/', title: 'Contact' },
  { url: 'https://github.com/saketh123b', title: 'GitHub' },
];

let nav = document.createElement('nav');
document.body.prepend(nav);

// Treat /folder/ and /folder/index.html as the same page
const normalize = (path) => path.replace(/index\.html$/, '');

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  url = !url.startsWith('http') ? BASE_PATH + url : url;

  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;

  a.classList.toggle(
    'current',
    a.host === location.host &&
      normalize(a.pathname) === normalize(location.pathname),
  );
  if (a.host !== location.host) a.target = '_blank';

  nav.append(a);
}

// ---------- Step 4: dark mode switch ----------
document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);

let select = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  select.value = colorScheme;
}

select.addEventListener('input', function (event) {
  setColorScheme(event.target.value);
  localStorage.colorScheme = event.target.value;
});

if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

// ---------- Lab 4: data helpers ----------
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!(containerElement instanceof Element)) {
    console.error('renderProjects: invalid container element');
    return;
  }

  if (!/^h[1-6]$/.test(headingLevel)) {
    console.warn(`Invalid headingLevel "${headingLevel}", using h2`);
    headingLevel = 'h2';
  }

  containerElement.innerHTML = '';

  if (!Array.isArray(projects) || projects.length === 0) {
    containerElement.innerHTML = '<p>No projects to display yet.</p>';
    return;
  }

  for (const project of projects) {
    const article = document.createElement('article');
    article.innerHTML = `
      <${headingLevel}>${project.title ?? 'Untitled'}</${headingLevel}>
      <img src="${project.image ?? ''}" alt="${project.title ?? 'Project image'}">
      <p>${project.description ?? ''}</p>
    `;
    containerElement.appendChild(article);
  }
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}