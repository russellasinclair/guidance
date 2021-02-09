/*
Starfinder utilities for Roll20
Requires API, Starfinder (Simple) character sheets - official sheets not supported at this time.
!sf_populate - will parse a stat-block in the GM Notes of a character, and populate the NPC tab of the character sheet with the values
*/
var Guidance = Guidance || (function () {

    var updateAll = true;
    on("ready", function () {
        metatron("Greetings, I am Guidance. " +
            "I am here to assist you working with your Starfinders to make " +
            "your time in the Pact Worlds more enjoyable. To learn how to use " +
            "my services, simply type <b>sf_help</b> into the chat!");
        metatron("I'm currently at version 0.8")
    });

    on("chat:message", function (msg) {
        if (msg.type !== "api" || !playerIsGM(msg.playerid)) {
            return;
        }

        if (String(msg.content).startsWith("!sf_help")) {
            metatron("I have several commands I support:\n" +
                "<b><i>sf_populate</i></b> will allow you to take a Starfinder statblock " +
                "that is in the GM notes section of a selected character and I " +
                "will attempt to use it to fill out the NPC section of the " +
                "Starfinder (Simple) character sheet\n\n");
            metatron("Currently, I support statblocks from the " +
                "Roll20 compendium and Archives of Nethys.");
            metatron("<b><i>sf_clean CONFIRM</i></b> will allow me to take a " +
                "selected character sheet and completely <b>AND PERMANENTLY</b> remove " +
                "all data from it. I recommend against using this unless you are" +
                "about to reimport a character.");
            return;
        }

        var token;
        try {
            token = findObjs(msg.selected[0])[0];
        } catch (err) {
            metatron("Linked Token has not been selected");
            return;
        }

        var ident = token.get("represents");
        var char = findObjs({_id: ident, _type: "character"})[0];

        // Code for Testing and Debugging
        if (String(msg.content).startsWith("!sf_debug")) {
            log("start");
            char.get("gmnotes", function (gmnotes) {
                cleanNotes = cleanText(gmnotes);
                var section = getSubSections(cleanNotes);
                for (const [key, value] of section.entries()) {
                    log(key, value);
                }
            });
            log("Done");
        }

        // Wipe out all Character Data
        if (String(msg.content).startsWith("!sf_clean CONFIRM")) {
            for (prop of findObjs({_characterid: ident, _type: "attribute"})) {
                log("Removing " + prop.get("name"));
                prop.remove();
            }
            for (var i = 1; i < 4; i++) {
                token.set("bar" + i + "_value", "");
                token.set("bar" + i + "_max", "");
            }
            token.set("gmnotes", "");
            metatron("Removed all properties for " + char.get("name"));
        }

        // Populate the Character Sheet
        if (String(msg.content).startsWith("!sf_populate")) {
            char.get("gmnotes", function (gmnotes) {
                cleanNotes = cleanText(gmnotes);

                var section = getSubSections(cleanNotes);
                // For Debugging purposes and general information
                token.set("gmnotes", cleanNotes);

                setAttribute(ident, "npc-race", char.get("name"));
                populateHeader(section.get('header'), ident);
                populateDefense(section.get('defense'), ident);
                populateOffense(section.get('offense'), ident);
                populateStatics(section.get('statistics'), ident);
                populateSkills(section.get('statistics'), ident);

                populateNPC(cleanNotes, ident);

                // Set up Token
                var hp = findObjs({
                    _characterid: ident,
                    _type: "attribute",
                    name: "HP-npc"
                })[0];
                token.set("bar1_link", hp.id);

                var ac = findObjs({
                    _characterid: ident,
                    _type: "attribute",
                    name: "EAC-npc"
                })[0];

                token.set("bar2_value", "EAC " + ac.get("current"));
                token.set("bar2_max", ac.get("current"));

                var ac = findObjs({
                    _characterid: ident,
                    _type: "attribute",
                    name: "KAC-npc"
                })[0];
                token.set("bar3_value", "KAC " + ac.get("current"));
                token.set("bar3_max", ac.get("current"));
                token.set("showname", true);
                setAttribute(char.get("_id"), "tab", 4);
                metatron("char.get("
                name
                ") + "
                NPC
                character
                sheet
                processed
                ");
            });
        }
    });

    var getSubSections = function (gmnotes) {
        let sections = new Map();
        sections.set('header', gmnotes.substr(0, gmnotes.indexOf("DEFENSE")));
        sections.set('defense', gmnotes.substr(gmnotes.indexOf("DEFENSE"), gmnotes.indexOf("OFFENSE")));
        if (gmnotes.indexOf("TACTICS") > 0) {
            sections.set('offense', gmnotes.substr(gmnotes.indexOf("OFFENSE"), gmnotes.indexOf("TACTICS")));
            sections.set('tactics', gmnotes.substr(gmnotes.indexOf("TACTICS"), gmnotes.indexOf("STATISTICS")));
        } else {
            sections.set('offense', gmnotes.substr(gmnotes.indexOf("OFFENSE"), gmnotes.indexOf("STATISTICS")));
        }
        sections.set('statistics', gmnotes.substr(gmnotes.indexOf("STATISTICS")));
        return sections;
    }

    // Populate data
    var doSpells = function (gmnotes, ident) {
    };
    var cleanText = function (text) {
        return text.replace(/(<([^>]+)>)/gi, " "
        ).replace(/&nbsp;/gi, " "
        ).replace(/\s+/g, ' '
        ).replace(/Offense/i, "OFFENSE"
        ).replace(/Defense/i, "DEFENSE"
        ).replace(/Statistics/i, "STATISTICS"
        ).replace(/Ecology/i, "ECOLOGY"
        ).replace(/Special Abilities/i, "SPECIAL ABILITIES"
        ).replace(/Tactics/i, "TACTICS");
    }

    var populateHeader = function (gmnotes, char) {
        setAttribute(char, "npc-cr", getValue("CR", gmnotes));
        setAttribute(char, "npc-XP", getValue("XP", gmnotes));
        setAttribute(char, "npc-senses", getValue("Senses", gmnotes, ";"));
        setAttribute(char, "npc-init-misc", getSkillValue("Init", "Dex", gmnotes));
    }
    var populateDefense = function (gmnotes, char) {
        setAttribute(char, "EAC-npc", getValue("EAC", gmnotes));
        setAttribute(char, "KAC-npc", getValue("KAC", gmnotes));
        setAttribute(char, "Fort-npc", getValue("Fort", gmnotes));
        setAttribute(char, "Ref-npc", getValue("Ref", gmnotes));
        setAttribute(char, "Will-npc", getValue("Will", gmnotes));
        setAttribute(char, "HP-npc", getValue("HP", gmnotes));
        setAttribute(char, "npc-resistances", getValue("Resistances", gmnotes, ";"));
    }
    var populateOffense = function (gmnotes, char) {
        setAttribute(char, "npc-special-attacks", getValue("Offensive Abilities", gmnotes, "Statistics"));
        doWeapons(gmnotes, char);
        doSpells(gmnotes, char);
    }
    var populateStatics = function (gmnotes, char) {
        setAttribute(char, "STR-bonus", getValue("Str", gmnotes));
        setAttribute(char, "DEX-bonus", getValue("Dex", gmnotes));
        setAttribute(char, "CON-bonus", getValue("Con", gmnotes));
        setAttribute(char, "INT-bonus", getValue("Int", gmnotes));
        setAttribute(char, "WIS-bonus", getValue("Wis", gmnotes));
        setAttribute(char, "CHA-bonus", getValue("Cha", gmnotes));
        setAttribute(char, "languages-npc", getValue("Languages", gmnotes, "Other"));
        setAttribute(char, "npc-gear", getValue("Gear", gmnotes, "Ecology"));
        setAttribute(char, "SQ", getValue("Other Abilities", gmnotes, "Gear"));
    }

    var populateSkills = function (gmnotes, char) {
        setAttribute(char, "Acrobatics-npc-misc", getSkillValue("Acrobatics", "Dex", gmnotes));
        setAttribute(char, "Athletics-npc-misc", getSkillValue("Athletics", "Str", gmnotes));
        setAttribute(char, "Bluff-npc-misc", getSkillValue("Bluff", "Cha", gmnotes));
        setAttribute(char, "Computers-npc-misc", getSkillValue("Computers", "Int", gmnotes));
        setAttribute(char, "Culture-npc-misc", getSkillValue("Culture", "Int", gmnotes));
        setAttribute(char, "Diplomacy-npc-misc", getSkillValue("Diplomacy", "Cha", gmnotes));
        setAttribute(char, "Disguise-npc-misc", getSkillValue("Disguise", "Cha", gmnotes));
        setAttribute(char, "Engineering-npc-misc", getSkillValue("Engineering", "Int", gmnotes));
        setAttribute(char, "Intimidate-npc-misc", getSkillValue("Intimidate", "Cha", gmnotes));
        setAttribute(char, "Life-Science-npc-misc", getSkillValue("Life-Science", "Int", gmnotes));
        setAttribute(char, "Medicine-npc-misc", getSkillValue("Medicine", "Int", gmnotes));
        setAttribute(char, "Mysticism-npc-misc", getSkillValue("Mysticism", "Wis", gmnotes));
        setAttribute(char, "Physical-Science-npc-misc", getSkillValue("Physical-Science", "Int", gmnotes));
        setAttribute(char, "Piloting-npc-misc", getSkillValue("Piloting", "Dex", gmnotes));
        setAttribute(char, "Sense-Motive-npc-misc", getSkillValue("Sense-Motive", "Wis", gmnotes));
        setAttribute(char, "Sleight-of-Hand-npc-misc", getSkillValue("Sleight-of-Hand", "Dex", gmnotes));
        setAttribute(char, "Stealth-npc-misc", getSkillValue("Stealth", "Dex", gmnotes));
        setAttribute(char, "Survival-npc-misc", getSkillValue("Survival", "Wis", gmnotes));
    }

    // Everything Else that needs more detail
    var populateNPC = function (gmnotes, char) {
        setAttribute(char, "Perception-npc-misc", getSkillValue("Perception", "Wis", gmnotes));

        try {
            var section = getStringValue("XP", gmnotes, "DEFENSE").trim();
            var subsections = section.split(' ');

            if (subsections[1].length > 1) {
                setAttribute(char, "npc-alignment", subsections[1]);
            }

            var size = subsections[2].trim();
            var dropdown = 0;
            log("Size = " + size);

            switch (size) {
                case "Colossal" :
                    dropdown = -8;
                    break;
                case "Gargantuan" :
                    dropdown = -4;
                    break;
                case "Huge" :
                    dropdown = -2;
                    break;
                case "Large" :
                    dropdown = -1;
                    break;
                case "Medium" :
                    dropdown = 0;
                    break;
                case "Small" :
                    dropdown = 1;
                    break;
                case "Tiny" :
                    dropdown = 2;
                    break;
                case "Diminutive" :
                    dropdown = 4;
                    break;
                case "Fine" :
                    dropdown = 8;
                    break;
                default :
                    dropdown = 0;
            }

            setAttribute(char, "npc-size", dropdown);
            i = 3;
            subtype = "";
            while (subsections[i].trim() != "Init") {
                subtype = subtype + subsections[i] + " ";
                i++;
            }

            setAttribute(char, "npc-subtype", subtype);
        } catch (err) {
            log("Problems with alignment, size,subtype");
        }
    };

    var doWeapons = function (gmnotes, ident) {
        gmnotes = gmnotes.replace(/Attacks/i, "").replace(/ or /g, ";").replace(/Ranged/g, ";").replace(/Melee/g, ";"
        ).replace(/OFFENSE/, "");

        if (gmnotes.indexOf("Space") > 0) {
            gmnotes = gmnotes.substr(0, gmnotes.indexOf("Space"))
        }

        if (gmnotes.indexOf("Spells") > 0) {
            gmnotes = gmnotes.substr(0, gmnotes.indexOf("Spells"))
        }

        var attacks = gmnotes.split(";")
        for (attack of attacks) {
            attack = attack.trim();
            if (attack.length > 1) {
                if (!(attack.startsWith("Space") || attack.startsWith("Reach"))) {
                    try {
                        armNPC(attack, ident);
                    } catch (err) {
                        metatron("Could not populate data for weapon " + attack);
                    }
                }
            }

        }
    };

    var armNPC = function (attack, ident) {
        log("Parsing " + attack);
        var uuid = generateRowID();

        var details = attack.split(' ');
        var i = 0;
        var weapon = "";
        while (isNaN(details[i]) && i < details.length) {
            weapon = weapon + details[i] + " ";
            i++;
        }

        setAttribute(ident, "repeating_npc-weapon_" + uuid + "_npc-weapon-notes", attack);
        setAttribute(ident, "repeating_npc-weapon_" + uuid + "_npc-weapon-name", weapon);
        var attackBonus = details[i];
        setAttribute(ident, "repeating_npc-weapon_" + uuid + "_npc-weapon-attack", attackBonus);
        i++;

        var damage = details[i].replace(/\(/, "");
        var numDice = damage.split('d');
        var dnd = numDice[1].split("+");
        setAttribute(ident, "repeating_npc-weapon_" + uuid + "_npc-dice-num", numDice[0]);
        setAttribute(ident, "repeating_npc-weapon_" + uuid + "_npc-damage-die", dnd[0]);

        if (dnd[1] != undefined) {
            setAttribute(ident, "repeating_npc-weapon_" + uuid + "_npc-weapon-damage", dnd[1]);
        }
    };

    // borrowed from https://app.roll20.net/users/901082/invincible-spleen in the forums
    var setAttribute = function (characterID, attributeName, newValue, operator) {
        var mod_newValue = {
                "+": function (num) {
                    return num;
                },
                "-": function (num) {
                    return -num;
                }
            },

            foundAttribute = findObjs({
                _characterid: characterID,
                _type: "attribute",
                name: attributeName
            })[0];
        try {
            if (!foundAttribute) {
                if (typeof operator !== 'undefined' && !isNaN(newValue)) {
                    log(newValue + " is a number.");
                    newValue = mod_newValue[operator](newValue);
                }

                log("DefaultAttributes: Initializing " + attributeName + " on character ID " + characterID + " with a value of " + newValue + ".");
                createObj("attribute", {
                    name: attributeName,
                    current: newValue,
                    max: newValue,
                    characterid: characterID
                });
            } else {
                if (typeof operator !== 'undefined' && !isNaN(newValue) && !isNaN(foundAttribute.get("current"))) {
                    newValue = parseFloat(foundAttribute.get("current")) + parseFloat(mod_newValue[operator](newValue));
                }
                log("DefaultAttributes: Setting " + attributeName + " on character ID " + characterID + " to a value of " + newValue + ".");
                foundAttribute.set("current", newValue);
                foundAttribute.set("max", newValue);
                updateAll = false;
            }
        } catch (err) {
            log("Error parsing " + attributeName)
        }
    };

    // Parsing routines
    var getSkillValue = function (skillName, attribute, haystack) {
        if (Number(getValue(skillName, haystack).trim()) > 2) {
            return Number(getValue(skillName, haystack).trim()) - Number(getValue(attribute, haystack).trim())
        }
        return 0;
    };

    var getValue = function (needle, haystack, delimiter) {
        bucket = getStringValue(needle, haystack, delimiter);
        return bucket.replace(";", "").replace("+", "").trim();
    };

    var getStringValue = function (needle, haystack, delimiter) {
        if (haystack.indexOf(needle) < 0) {
            return "";
        }
        var start = haystack.indexOf(needle) + needle.length;
        if (start < 0) {
            return "";
        }
        var bucket = haystack.substr(start);
        if (delimiter === undefined) {
            delimiter = " ";
        }
        bucket = bucket.trim();
        var end = bucket.toLowerCase().indexOf(delimiter.toLowerCase());
        bucket = bucket.substr(0, end);
        return bucket

    };

    // Thanks Aaron
    generateUUID = (function () {
        "use strict";

        var a = 0, b = [];
        return function () {
            var c = (new Date()).getTime() + 0, d = c === a;
            a = c;
            for (var e = new Array(8), f = 7; 0 <= f; f--) {
                e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
                c = Math.floor(c / 64);
            }
            c = e.join("");
            if (d) {
                for (f = 11; 0 <= f && 63 === b[f]; f--) {
                    b[f] = 0;
                }
                b[f]++;
            } else {
                for (f = 0; 12 > f; f++) {
                    b[f] = Math.floor(64 * Math.random());
                }
            }
            for (f = 0; 12 > f; f++) {
                c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
            }

            return c;
        };
    }()),
        generateRowID = function () {
            "use strict";
            return generateUUID().replace(/_/g, "Z");
        };

    var metatron = function (text) {
        sendChat("Guidance", "/w gm " + text);
    };
}
());