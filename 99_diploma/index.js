require("dotenv").config();

const express = require("express");
const nunjucks = require("nunjucks");
const cookieParser = require("cookie-parser");
const db = require("./db");

const app = express();

db.migrate
  .latest()
  .then(() => console.log("Knex: Таблицы готовы!"))
  .catch((err) => console.error(err));

nunjucks.configure("views", {
  autoescape: true,
  express: app,
});

app.use(cookieParser(process.env.COOKIE_SECRET));
app.set("view engine", "njk");
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const { router: authRoutes, auth } = require("./routes/auth");
const notesRoutes = require("./routes/notes");

app.use(auth);
app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);

app.get("/", auth, (req, res) => {
  if (req.user) {
    return res.render("dashboard", req.user.name);
  }
  res.render("index", req.user);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
