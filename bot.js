// ============================================================
//  Discord Roblox Moderation Bot  v2.0
//  Commands: whitelist, unwhitelist, ban, unban, warn,
//            warnings, clearwarns, note, notes, lookup,
//            banlist, wllist, stats, help
//  Requirements: npm install discord.js
// ============================================================

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");

// ══════════════════════════════════════════════════════════
//  CONFIG  —  edit these values
// ══════════════════════════════════════════════════════════
const BOT_TOKEN = "const BOT_TOKEN = process.env.BOT_TOKEN;"; // Your Discord bot token
const PREFIX    = "!";                   // Command prefix
const DATA_FILE = "./players.json";      // Database file (auto-created)

// Role IDs allowed to use mod commands. Set to [] to allow everyone.
const ADMIN_ROLE_IDS = ["1458121371044417707","1458121383455494409","1458121372839575593"]; // e.g. ["1234567890", "9876543210"]
// ══════════════════════════════════════════════════════════

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ──────────────────────────────────────────────────────────
//  DATABASE HELPERS
// ──────────────────────────────────────────────────────────

function loadDB() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ players: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function getPlayer(userId) {
  const db = loadDB();
  return db.players[userId] || null;
}

function getOrCreatePlayer(userId) {
  const db = loadDB();
  if (!db.players[userId]) {
    db.players[userId] = {
      userId,
      whitelisted: false,
      whitelistedAt: null,
      whitelistedBy: null,
      banned: false,
      bannedAt: null,
      bannedBy: null,
      banReason: null,
      warnings: [],
      notes: [],
    };
    saveDB(db);
  }
  return db.players[userId];
}

function updatePlayer(userId, fields) {
  const db = loadDB();
  if (!db.players[userId]) getOrCreatePlayer(userId);
  Object.assign(db.players[userId], fields);
  saveDB(db);
}

function hasPermission(member) {
  if (ADMIN_ROLE_IDS.length === 0) return true;
  return ADMIN_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

function now() {
  return new Date().toISOString();
}

function formatDate(iso) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ──────────────────────────────────────────────────────────
//  SHARED EMBEDS
// ──────────────────────────────────────────────────────────

function permDenied() {
  return new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle("❌ Permission Denied")
    .setDescription("You don't have permission to use this command.");
}

function missingArg(usage) {
  return new EmbedBuilder()
    .setColor(0xffaa00)
    .setTitle("⚠️ Missing Argument")
    .setDescription(`**Usage:** \`${usage}\``);
}

// ──────────────────────────────────────────────────────────
//  BOT READY
// ──────────────────────────────────────────────────────────

client.once("ready", () => {
  console.log(`✅  Logged in as ${client.user.tag}`);
  client.user.setActivity("Roblox Mod Panel | !help");
});

// ──────────────────────────────────────────────────────────
//  MESSAGE HANDLER
// ──────────────────────────────────────────────────────────

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args    = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();
  const reply   = (embed) => message.reply({ embeds: [embed] });

  // ════════════════════════════════════════════════════════
  //  !whitelist <robloxId>
  // ════════════════════════════════════════════════════════
  if (command === "whitelist") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    if (!robloxId) return reply(missingArg(`${PREFIX}whitelist <RobloxUserID>`));

    const player = getOrCreatePlayer(robloxId);

    if (player.whitelisted) {
      return reply(
        new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle("⚠️ Already Whitelisted")
          .setDescription(`Roblox ID **${robloxId}** is already on the whitelist.`)
          .addFields(
            { name: "Whitelisted By", value: player.whitelistedBy || "Unknown", inline: true },
            { name: "Whitelisted At", value: formatDate(player.whitelistedAt),  inline: true }
          )
          .setFooter({ text: "No changes were made." })
          .setTimestamp()
      );
    }

    if (player.banned) {
      return reply(
        new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Player is Banned")
          .setDescription(`Roblox ID **${robloxId}** is currently **banned**. Unban them first before whitelisting.`)
          .addFields({ name: "Ban Reason", value: player.banReason || "No reason given" })
          .setTimestamp()
      );
    }

    updatePlayer(robloxId, {
      whitelisted: true,
      whitelistedAt: now(),
      whitelistedBy: message.author.tag,
    });

    return reply(
      new EmbedBuilder()
        .setColor(0x00cc66)
        .setTitle("✅ Player Whitelisted")
        .setDescription(`Roblox ID **${robloxId}** has been added to the whitelist.`)
        .addFields(
          { name: "Roblox ID", value: robloxId,           inline: true },
          { name: "Added By",  value: message.author.tag, inline: true }
        )
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !unwhitelist <robloxId>
  // ════════════════════════════════════════════════════════
  if (command === "unwhitelist") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    if (!robloxId) return reply(missingArg(`${PREFIX}unwhitelist <RobloxUserID>`));

    const player = getPlayer(robloxId);

    if (!player || !player.whitelisted) {
      return reply(
        new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Not Whitelisted")
          .setDescription(`Roblox ID **${robloxId}** is not on the whitelist.`)
          .setTimestamp()
      );
    }

    updatePlayer(robloxId, {
      whitelisted: false,
      whitelistedAt: null,
      whitelistedBy: null,
    });

    return reply(
      new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle("🚫 Player Unwhitelisted")
        .setDescription(`Roblox ID **${robloxId}** has been removed from the whitelist.`)
        .addFields({ name: "Removed By", value: message.author.tag, inline: true })
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !ban <robloxId> [reason]
  // ════════════════════════════════════════════════════════
  if (command === "ban") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    if (!robloxId) return reply(missingArg(`${PREFIX}ban <RobloxUserID> [reason]`));

    const reason = args.slice(1).join(" ") || "No reason provided";
    const player = getOrCreatePlayer(robloxId);

    if (player.banned) {
      return reply(
        new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle("⚠️ Already Banned")
          .setDescription(`Roblox ID **${robloxId}** is already banned.`)
          .addFields(
            { name: "Banned By",  value: player.bannedBy || "Unknown", inline: true },
            { name: "Banned At",  value: formatDate(player.bannedAt),  inline: true },
            { name: "Ban Reason", value: player.banReason || "None"                 }
          )
          .setFooter({ text: "No changes were made." })
          .setTimestamp()
      );
    }

    // Auto-remove from whitelist when banned
    updatePlayer(robloxId, {
      banned: true,
      bannedAt: now(),
      bannedBy: message.author.tag,
      banReason: reason,
      whitelisted: false,
      whitelistedAt: null,
      whitelistedBy: null,
    });

    return reply(
      new EmbedBuilder()
        .setColor(0xdd2222)
        .setTitle("🔨 Player Banned")
        .setDescription(`Roblox ID **${robloxId}** has been banned from the game.`)
        .addFields(
          { name: "Roblox ID", value: robloxId,           inline: true },
          { name: "Banned By", value: message.author.tag, inline: true },
          { name: "Reason",    value: reason                            }
        )
        .setFooter({ text: "Player was also removed from the whitelist." })
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !unban <robloxId>
  // ════════════════════════════════════════════════════════
  if (command === "unban") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    if (!robloxId) return reply(missingArg(`${PREFIX}unban <RobloxUserID>`));

    const player = getPlayer(robloxId);

    if (!player || !player.banned) {
      return reply(
        new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Not Banned")
          .setDescription(`Roblox ID **${robloxId}** is not currently banned.`)
          .setTimestamp()
      );
    }

    updatePlayer(robloxId, {
      banned: false,
      bannedAt: null,
      bannedBy: null,
      banReason: null,
    });

    return reply(
      new EmbedBuilder()
        .setColor(0x00cc66)
        .setTitle("✅ Player Unbanned")
        .setDescription(`Roblox ID **${robloxId}** has been unbanned.`)
        .addFields({ name: "Unbanned By", value: message.author.tag, inline: true })
        .setFooter({ text: "You can now whitelist this player again." })
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !warn <robloxId> <reason>
  // ════════════════════════════════════════════════════════
  if (command === "warn") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    const reason   = args.slice(1).join(" ");

    if (!robloxId || !reason) return reply(missingArg(`${PREFIX}warn <RobloxUserID> <reason>`));

    const db = loadDB();
    if (!db.players[robloxId]) getOrCreatePlayer(robloxId);
    db.players[robloxId].warnings.push({ reason, warnedBy: message.author.tag, warnedAt: now() });
    saveDB(db);

    const count = db.players[robloxId].warnings.length;

    return reply(
      new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle("⚠️ Player Warned")
        .setDescription(`Roblox ID **${robloxId}** has received a warning.`)
        .addFields(
          { name: "Reason",         value: reason,             inline: false },
          { name: "Warned By",      value: message.author.tag, inline: true  },
          { name: "Total Warnings", value: `${count}`,         inline: true  }
        )
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !warnings <robloxId>
  // ════════════════════════════════════════════════════════
  if (command === "warnings") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    if (!robloxId) return reply(missingArg(`${PREFIX}warnings <RobloxUserID>`));

    const player = getPlayer(robloxId);

    if (!player || player.warnings.length === 0) {
      return reply(
        new EmbedBuilder()
          .setColor(0x00cc66)
          .setTitle("📋 Warnings")
          .setDescription(`Roblox ID **${robloxId}** has **no warnings**.`)
          .setTimestamp()
      );
    }

    const warnList = player.warnings
      .map((w, i) => `**${i + 1}.** ${w.reason}\n> by **${w.warnedBy}** on ${formatDate(w.warnedAt)}`)
      .join("\n\n");

    return reply(
      new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle(`⚠️ Warnings — ${robloxId}`)
        .setDescription(warnList)
        .setFooter({ text: `${player.warnings.length} warning(s) total` })
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !clearwarns <robloxId>
  // ════════════════════════════════════════════════════════
  if (command === "clearwarns") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    if (!robloxId) return reply(missingArg(`${PREFIX}clearwarns <RobloxUserID>`));

    const player = getPlayer(robloxId);

    if (!player || player.warnings.length === 0) {
      return reply(
        new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle("⚠️ No Warnings")
          .setDescription(`Roblox ID **${robloxId}** has no warnings to clear.`)
          .setTimestamp()
      );
    }

    const count = player.warnings.length;
    updatePlayer(robloxId, { warnings: [] });

    return reply(
      new EmbedBuilder()
        .setColor(0x00cc66)
        .setTitle("🧹 Warnings Cleared")
        .setDescription(`Cleared **${count}** warning(s) from Roblox ID **${robloxId}**.`)
        .addFields({ name: "Cleared By", value: message.author.tag, inline: true })
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !note <robloxId> <text>
  // ════════════════════════════════════════════════════════
  if (command === "note") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    const text     = args.slice(1).join(" ");

    if (!robloxId || !text) return reply(missingArg(`${PREFIX}note <RobloxUserID> <note text>`));

    const db = loadDB();
    if (!db.players[robloxId]) getOrCreatePlayer(robloxId);
    db.players[robloxId].notes.push({ text, addedBy: message.author.tag, addedAt: now() });
    saveDB(db);

    return reply(
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📝 Note Added")
        .setDescription(`Note added to Roblox ID **${robloxId}**.`)
        .addFields(
          { name: "Note",     value: text,               inline: false },
          { name: "Added By", value: message.author.tag, inline: true  }
        )
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !notes <robloxId>
  // ════════════════════════════════════════════════════════
  if (command === "notes") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    if (!robloxId) return reply(missingArg(`${PREFIX}notes <RobloxUserID>`));

    const player = getPlayer(robloxId);

    if (!player || player.notes.length === 0) {
      return reply(
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("📝 Notes")
          .setDescription(`Roblox ID **${robloxId}** has **no notes**.`)
          .setTimestamp()
      );
    }

    const noteList = player.notes
      .map((n, i) => `**${i + 1}.** ${n.text}\n> by **${n.addedBy}** on ${formatDate(n.addedAt)}`)
      .join("\n\n");

    return reply(
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📝 Notes — ${robloxId}`)
        .setDescription(noteList)
        .setFooter({ text: `${player.notes.length} note(s) total` })
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !lookup <robloxId>  —  full player profile
  // ════════════════════════════════════════════════════════
  if (command === "lookup") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const robloxId = args[0];
    if (!robloxId) return reply(missingArg(`${PREFIX}lookup <RobloxUserID>`));

    const player = getPlayer(robloxId);

    if (!player) {
      return reply(
        new EmbedBuilder()
          .setColor(0x888888)
          .setTitle("🔍 Player Not Found")
          .setDescription(`No data found for Roblox ID **${robloxId}**.`)
          .setTimestamp()
      );
    }

    const statusLine = player.banned
      ? "🔨 Banned"
      : player.whitelisted
      ? "✅ Whitelisted"
      : "⬜ No Status";

    return reply(
      new EmbedBuilder()
        .setColor(player.banned ? 0xdd2222 : player.whitelisted ? 0x00cc66 : 0x888888)
        .setTitle(`🔍 Player Lookup — ${robloxId}`)
        .addFields(
          { name: "Status",      value: statusLine,                                                                   inline: true  },
          { name: "⚠️ Warnings", value: `${player.warnings.length}`,                                                 inline: true  },
          { name: "📝 Notes",    value: `${player.notes.length}`,                                                     inline: true  },
          { name: "Whitelisted", value: player.whitelisted ? `Yes, by **${player.whitelistedBy}** on ${formatDate(player.whitelistedAt)}` : "No", inline: false },
          { name: "Banned",      value: player.banned ? `Yes — *${player.banReason}*\nby **${player.bannedBy}** on ${formatDate(player.bannedAt)}` : "No", inline: false }
        )
        .setFooter({ text: `Use ${PREFIX}warnings ${robloxId} or ${PREFIX}notes ${robloxId} for full details` })
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !banlist  —  all banned players
  // ════════════════════════════════════════════════════════
  if (command === "banlist") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const db     = loadDB();
    const banned = Object.values(db.players).filter((p) => p.banned);

    if (banned.length === 0) {
      return reply(
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🔨 Ban List")
          .setDescription("No players are currently banned.")
          .setTimestamp()
      );
    }

    const list = banned
      .map((p, i) => `${i + 1}. \`${p.userId}\` — *${p.banReason || "No reason"}* (by **${p.bannedBy}**)`)
      .join("\n");

    return reply(
      new EmbedBuilder()
        .setColor(0xdd2222)
        .setTitle("🔨 Ban List")
        .setDescription(list)
        .setFooter({ text: `${banned.length} banned player(s)` })
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !wllist  —  all whitelisted players
  // ════════════════════════════════════════════════════════
  if (command === "wllist") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const db  = loadDB();
    const wled = Object.values(db.players).filter((p) => p.whitelisted);

    if (wled.length === 0) {
      return reply(
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("📋 Whitelist")
          .setDescription("The whitelist is currently empty.")
          .setTimestamp()
      );
    }

    const list = wled
      .map((p, i) => `${i + 1}. \`${p.userId}\` — added by **${p.whitelistedBy}**`)
      .join("\n");

    return reply(
      new EmbedBuilder()
        .setColor(0x00cc66)
        .setTitle("📋 Whitelist")
        .setDescription(list)
        .setFooter({ text: `${wled.length} whitelisted player(s)` })
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !stats  —  overview
  // ════════════════════════════════════════════════════════
  if (command === "stats") {
    if (!hasPermission(message.member)) return reply(permDenied());

    const db      = loadDB();
    const players = Object.values(db.players);

    return reply(
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📊 Bot Statistics")
        .addFields(
          { name: "Total Players",    value: `${players.length}`,                                     inline: true },
          { name: "✅ Whitelisted",   value: `${players.filter((p) => p.whitelisted).length}`,        inline: true },
          { name: "🔨 Banned",        value: `${players.filter((p) => p.banned).length}`,             inline: true },
          { name: "⚠️ Have Warnings", value: `${players.filter((p) => p.warnings.length > 0).length}`, inline: true }
        )
        .setTimestamp()
    );
  }

  // ════════════════════════════════════════════════════════
  //  !help
  // ════════════════════════════════════════════════════════
  if (command === "help") {
    return reply(
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📖 All Commands")
        .addFields(
          {
            name: "🟢 Whitelist",
            value: [
              `\`${PREFIX}whitelist <ID>\` — Add player to whitelist`,
              `\`${PREFIX}unwhitelist <ID>\` — Remove from whitelist`,
              `\`${PREFIX}wllist\` — Show all whitelisted players`,
            ].join("\n"),
          },
          {
            name: "🔨 Bans",
            value: [
              `\`${PREFIX}ban <ID> [reason]\` — Ban a player (also removes whitelist)`,
              `\`${PREFIX}unban <ID>\` — Unban a player`,
              `\`${PREFIX}banlist\` — Show all banned players`,
            ].join("\n"),
          },
          {
            name: "⚠️ Warnings",
            value: [
              `\`${PREFIX}warn <ID> <reason>\` — Warn a player`,
              `\`${PREFIX}warnings <ID>\` — View a player's warnings`,
              `\`${PREFIX}clearwarns <ID>\` — Clear all warnings`,
            ].join("\n"),
          },
          {
            name: "📝 Notes",
            value: [
              `\`${PREFIX}note <ID> <text>\` — Add a private staff note`,
              `\`${PREFIX}notes <ID>\` — View all notes for a player`,
            ].join("\n"),
          },
          {
            name: "🔍 Info",
            value: [
              `\`${PREFIX}lookup <ID>\` — Full player profile`,
              `\`${PREFIX}stats\` — Database overview`,
              `\`${PREFIX}help\` — Show this menu`,
            ].join("\n"),
          }
        )
        .setFooter({ text: "Roblox Mod Bot v2.0" })
        .setTimestamp()
    );
  }
});

// ──────────────────────────────────────────────────────────
client.login(BOT_TOKEN);
