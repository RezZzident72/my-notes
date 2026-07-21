/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable("notes", (table)=> {
    table.increments("_id").primary();
    table.uuid("userId").references("_id").inTable("users").notNullable().onDelete("CASCADE");
    table.string("title", 100).notNullable();
    table.text("text").defaultTo("");
    table.boolean("isArchived").defaultTo(false);
    table.timestamp("created").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists("notes")
};
