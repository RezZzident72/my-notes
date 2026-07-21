const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const fs = require("fs")
const path = require("path")

//**========РАБОТА С БАЗОЙ=========== */
const findUserByusername = async (username) => {
  return await db("users").where({ name: username }).first();
};

const findUserBySessionId = async (sessionId) => {
  const sessionData = await db("sessions").where({ sessionId: sessionId }).first();
  if (!sessionData) return null;
  return db("users").where({ _id: sessionData.userId }).first();
};

const createSession = async (userId) => {
  const [session] = await db("sessions").insert({ userId: userId }).returning("sessionId");

  return session.sessionId;
};

const deleteSession = async (sessionId) => {
  await db("sessions").where({ sessionId: sessionId }).delete();
};
//**================================= */

//Проверка авторизации
const auth = async (req, res, next) => {
  if (!req.signedCookies["sessionId"]) {
    return next();
  }

  const user = await findUserBySessionId(req.signedCookies["sessionId"]);
  req.user = user;
  req.sessionId = req.signedCookies["sessionId"];
  next();
};

//Регистрация
router.post("/signup", auth, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render("index", { authError: "Имя и пароль обязательны для заполнения" });
    }

    const isFindUser = await findUserByusername(username);
    if (isFindUser) {
      return res.render("index", { authError: "Пользователь с таким именем уже существует" });
    }

    const hashPassord = await bcrypt.hash(password, 10);

    const [newUser] = await db("users").insert({ name: username, password: hashPassord }).returning("*");

    const welcomeText = fs.readFileSync(path.join(__dirname, "../templates/welcome.md"), "utf8");
    await db("notes").insert({
      userId: newUser._id,
      title: "Добро пожаловать! 👋",
      text: welcomeText,
      isArchived: false,
    });

    const sessionId = await createSession(newUser._id);

    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      signed: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    console.log("Успешная регистрация!");
    return res.redirect("/");
  } catch (error) {
    console.log("Ошибка регистрации:", error);
    return res.render("index", { authError: "Ошибка сервера при регистрации" });
  }
});

//Вход
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render("index", { authError: "Заполните все поля для входа" });
    }

    const findUser = await findUserByusername(username);
    if (!findUser) return res.render("index", { authError: "Такого пользователя нет" });

    const isPasswordCorrect = await bcrypt.compare(password, findUser.password);
    if (!isPasswordCorrect) {
      return res.render("index", { authError: "Неверное имя пользователя или пароль!" });
    }

    const sessionId = await createSession(findUser._id);
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      signed: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    console.log("Успешный вход!");
    res.redirect("/");
  } catch (error) {
    console.log("Ошибка входа:", error);
    res.render("index", { authError: "Ошибка сервера при входе" });
  }
});

//Выход
router.get("/logout", auth, async (req, res) => {
  try {
    if (!req.user) return res.redirect("/");
    await deleteSession(req.sessionId);
    return res
      .clearCookie("sessionId", {
        signed: true,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      })
      .redirect("/");
  } catch (error) {
    console.log("Ошибка при выходе", error);
    await deleteSession(req.sessionId);
    return res
      .clearCookie("sessionId", {
        signed: true,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      })
      .redirect("/");
  }
});

module.exports = { router, auth };
