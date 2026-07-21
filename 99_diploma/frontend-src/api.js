const PREFIX = "/api";

const req = (url, options = {}) => {
  const { body } = options;

  return fetch((PREFIX + url).replace(/\/\/$/, ""), {
    ...options,
    body: body ? JSON.stringify(body) : null,
    headers: {
      ...options.headers,
      ...(body
        ? {
            "Content-Type": "application/json",
          }
        : null),
    },
  }).then((res) =>
    res.ok
      ? res.json()
      : res.text().then((message) => {
          throw new Error(message);
        }),
  );
};

export const getNotes = ({ age, search, page } = {}) => {
  return req(`/notes?page=${page || 1}&age=${age || "1month"}&search=${search || ""}`, {
    method: "GET",
  });
};

export const createNote = (title, text) => {
  return req("/notes", {
    method: "POST",
    body: { title, text },
  });
};

export const getNote = (id) => {
  return req(`/notes/${id}`);
};

export const editNote = (id, title, text) => {
  return req(`/notes/${id}`, {
    method: "POST",
    body: { title, text },
  });
};

export const archiveNote = (id) => {
  return req(`/notes/${id}`, {
    method: "PATCH",
    body: { isArchived: true },
  });
};

export const unarchiveNote = (id) => {
  return req(`/notes/${id}`, {
    method: "PATCH",
    body: { isArchived: false },
  });
};

export const deleteNote = (id) => {
  return req(`/notes/${id}`, {
    method: "DELETE",
  });
};

export const deleteAllArchived = () => {
  return req("/notes?clear=archive", {
    method: "DELETE",
  });
};

export const notePdfUrl = (id) => {
  return `/api/notes/pdf/${id}`;
};
