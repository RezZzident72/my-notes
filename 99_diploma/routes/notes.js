const express = require("express");
const router = express.Router();
const { marked } = require("marked");
const PDFDocument = require("pdfkit");
const path = require("path");
const db = require("../db");

//*=====РАБОТА С ЗАМЕТКАМИ=====*//
//Получение заметок
router.get("/", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Необходима авторизация" });
    const { page, age, search } = req.query;
    const limit = 10;
    const offset = (Number(page || 1) - 1) * limit;
    let showArchived = false;
    if (age === "archive") {
      showArchived = true;
    }

    let userNotes = db("notes").where({
      userId: req.user._id,
      isArchived: showArchived,
    });

    if (search && search !== "") {
      const searchPattern = `%${search}%`;

      userNotes = userNotes.where("title", "ILIKE", searchPattern);
    }

    let notes = await userNotes.limit(limit).offset(offset);

    if (search && search !== "") {
      const escapedSearch = search.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const searchRegex = new RegExp(`(${escapedSearch})`, "ig");

      notes = notes.map((note) => {
        const updatedNote = { ...note };
        if (updatedNote.title) {
          updatedNote.highlights = updatedNote.title.replace(searchRegex, "<mark>$1</mark>");
        }
        return updatedNote;
      });
    }


    res.json({
      data: notes,
      hasMore: notes.length === limit,
    });
  } catch (error) {
    console.log("Ошибка полуечния заметок", error);
    return res.status(500).json({ error: "Ошибка сервера при получении всех заметок" });
  }
});

//Создание заметки
router.post("/", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Необходима авторизация" });
    const { title, text } = req.body;

    const [note] = await db("notes")
      .insert({
        userId: req.user._id,
        title: title || "Название заметки",
        text: text || "Содержимое заметки",
        isArchived: false,
      })
      .returning("*");

    res.status(201).json(note);
  } catch (error) {
    console.log("Ошибка создания заметки", error);
    return res.status(500).json({ error: "Ошибка сервера при создании заметки" });
  }
});

//Поиск одной заметки
router.get("/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Необходима авторизация" });
    const { id } = req.params;
    const note = await db("notes").where({ _id: id, userId: req.user._id }).first();
    if (!note) {
      return res.status(404).json({ error: "Заметка не найдена" });
    }

    return res.json({
      _id: note._id,
      title: note.title,
      text: note.text,
      isArchived: note.isArchived,
      html: marked(note.text),
    });
  } catch (error) {
    console.log("Ошибка нахождения заметки", error);
    res.status(500).json({ error: "Ошибка сервера при поиске заметки" });
  }
});

//Редактирование заметки
router.post("/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Необходима авторизация" });
    const { id } = req.params;
    const { title, text } = req.body;
    await db("notes").where({ _id: id, userId: req.user._id }).update({
      title: title,
      text: text,
      updated_at: db.fn.now(),
    });
    console.log("Запись успешно изменена!");
    return res.json({ success: true });
  } catch (error) {
    console.log("Ошибка редактирования заметки", error);
    res.status(500).json({ error: "Ошибка на сервере при изменении записи" });
  }
});
//*===========================*//

//*=====РАБОТА С АХИВОМ=====*//
//Удаление всего архива
router.delete("/", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Необходима авторизация" });

    if (req.query.clear === "archive") {
      await db("notes").where({ userId: req.user._id, isArchived: true }).delete();

      console.log("Весь архив пользователя успешно очищен через Query!");
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Неверный параметр удаления" });
  } catch (error) {
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});
//Изменение статуса заметки
router.patch("/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Необходима авторизация" });
    const { id } = req.params;
    const { isArchived } = req.body;

    await db("notes").where({ _id: id, userId: req.user._id }).update({
      isArchived: isArchived,
      updated_at: db.fn.now(),
    });
    res.json({ success: true });
  } catch (error) {
    console.log("Ошибка добавленив в архив", error);
    return res.status(500).json({ error: "Ошибка на сервере при добавлении в архив" });
  }
});
//Удаление одной заметки
router.delete("/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Необходима авторизация" });
    const { id } = req.params;
    await db("notes").where({ _id: id, userId: req.user._id }).delete();
    console.log("Заметка успешно удалена");
    res.json({ success: true });
  } catch (error) {
    console.log("Ошибка удаления заметки", error);
    return res.status(500).json({ error: "Ошибка на сервере при удалении заметки" });
  }
});
//*==========================*/

//*=====СКАЧИВАНИЕ PDF=====*/
router.get("/pdf/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Необходима авторизация" });
    const { id } = req.params;

    const note = await db("notes").where({ _id: id, userId: req.user._id }).first();
    if (!note) return res.status(404).json({ error: "Заметка не найдена" });

    //Настройка соединения
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="note-${id}.pdf"`);
    doc.pipe(res);

    //Поиск шрифта
    const fontPath = path.join(__dirname, "../fonts/Roboto-Regular.ttf");
    doc.font(fontPath);

    //Форматирование заголовка
    const cleanTitle = note.title
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, "")
      .trim();
    doc.fontSize(24).fillColor("#1e87f0").text(cleanTitle, { align: "center" });
    doc.moveDown(1.5);

    //Форматирование строк
    const lines = note.text.split("\n");
    lines.forEach((line) => {
      let cleanLine = line.trim();

      cleanLine = cleanLine.replace(
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu,
        "",
      );

      if (!cleanLine) {
        doc.moveDown(0.5);
        return;
      }

      cleanLine = cleanLine
        .replaceAll("#", "")
        .replaceAll(">", "")
        .replaceAll("**", "")
        .replaceAll("*", "")
        .replaceAll("`", "");

      const linkRegex = /\[(.*?)\]\((.*?)\)/;
      const match = cleanLine.match(linkRegex);

      //Форматирование ссылок
      if (match) {
        const linkText = match[1];
        const linkUrl = match[2];

        doc.fontSize(12).fillColor("#333333").text("Ссылка: ");
        doc.fontSize(12).fillColor("#1e87f0").text(linkText, {
          link: linkUrl,
          underline: true,
        });
        return;
      }

      if (cleanLine.startsWith("http://") || cleanLine.startsWith("https://")) {
        doc.fontSize(12).fillColor("#1e87f0").text(cleanLine, {
          link: cleanLine,
          underline: true,
        });
        return;
      }

      doc.fontSize(12).fillColor("#333333").text(cleanLine);
    });

    doc.end();
    console.log(`PDF для заметки ${id} успешно скачан на компьютер! 💾🚀`);
  } catch (error) {
    console.log("Не удалось создать файл PDF", error);
    res.status(500).json({ error: "Ошибка на сервере при создании PDF" });
  }
});
//*=======================*//
module.exports = router;
