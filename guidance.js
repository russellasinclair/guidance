/*
Starfinder utilities for Roll20
Requires API, Starfinder (Simple) character sheets - official sheets not supported at this time.
!sf_populate - will parse a stat-block in the GM Notes of a character, and populate the NPC tab of the character sheet with the values
*/
var Guidance = Guidance || (function () {
    var version = "-=> Guidance is online. v0.8 <=-";
    var debugMode = true;
    on("ready", function () {
        speakAsGuidanceToGM("Greetings, I am Guidance. I am here to assist you working with your Starfinders to make " +
            "your time in the Pact Worlds more enjoyable. To learn how to use my services, simply type " +
            "<b>sf_help</b> into the chat");
        speakAsGuidanceToGM(version);
        log(version);
    });

    on("chat:message", function (chatMessage) {
        if (chatMessage.type !== "api" || !playerIsGM(chatMessage.playerid)) {
            return;
        }

        try {
            if (String(chatMessage.content).startsWith("!sf_help")) {
                speakAsGuidanceToGM("I have several commands I support:\n\n");
                speakAsGuidanceToGM("<b><i>sf_populate</i></b> will allow you to take a Starfinder statblock that is in the GM notes section " +
                    "of a selected character and I will attempt to use it to fill out the NPC section of the Starfinder " +
                    "(Simple) character sheet\n\n");
                speakAsGuidanceToGM("Currently, I support statblocks from the Roll20 compendium and Archives of Nethys. " +
                    "<i>I don't do well with Society PDFs</i>. If you want to attempt using one, double check my work");
                speakAsGuidanceToGM("<b><i>sf_clean CONFIRM</i></b> will allow me to take a selected character sheet and completely " +
                    "<b>AND PERMANENTLY</b> remove all data from it. <i>I recommend against using this unless you are about " +
                    "to reimport a character</i>.");
                return;
            }

            var tokenLinkedToNpcCharacterSheet;
            try {
                tokenLinkedToNpcCharacterSheet = findObjs(chatMessage.selected[0])[0];
            } catch (e) {
                speakAsGuidanceToGM("Linked Token has not been selected");
                return;
            }

            var characterId;
            var characterSheet;

            try {
                characterId = tokenLinkedToNpcCharacterSheet.get("represents");
                characterSheet = findObjs({_id: characterId, _type: "character"})[0];
            } catch (e) {
                speakAsGuidanceToGM("Selected Token has not been linked to a character sheet");
                return;
            }

            // Code for Testing and Debugging
            if (String(chatMessage.content).startsWith("!sf_debug") && debugMode == true) {
                log("start");
                foundAttributes = findObjs({
                    _characterid: characterId,
                    _type: "attribute",
                });
                for (const attribute of foundAttributes) {
                    log(attribute);
                }
                log("Done");
            }

            // Wipe out all Character Data
            if (String(chatMessage.content).startsWith("!sf_clean CONFIRM")) {
                for (prop of findObjs({_characterid: characterId, _type: "attribute"})) {
                    log("Removing " + prop.get("name"));
                    prop.remove();
                }
                for (var i = 1; i < 4; i++) {
                    tokenLinkedToNpcCharacterSheet.set("bar" + i + "_value", "");
                    tokenLinkedToNpcCharacterSheet.set("bar" + i + "_max", "");
                }
                tokenLinkedToNpcCharacterSheet.set("gmnotes", "");
                try {
                    speakAsGuidanceToGM("Removed all properties for " + characterSheet.get("name"));
                } catch (e) {
                    speakAsGuidanceToGM("Removed all properties for NPC (possibly not linked correctly");
                }
            }

            // Populate the Character Sheet
            if (String(chatMessage.content).startsWith("!sf_populate")) {
                characterSheet.get("gmnotes", function (gmNotes) {
                    cleanNotes = cleanText(gmNotes);
                    var section = parseBlockIntoSubSectionMap(cleanNotes);

                    // For Debugging purposes and general information
                    tokenLinkedToNpcCharacterSheet.set("gmnotes", cleanNotes);

                    // Setup Character Sheet
                    setAttribute(characterId, "npc-race", characterSheet.get("name"));
                    setAttribute(characterId, "tab", 4);
                    setAttribute(characterId, "npc-tactics-show", 0);
                    populateHeader(characterId, section.get('header'));
                    populateDefense(characterId, section.get('defense'));
                    populateOffense(characterId, section.get('offense'));
                    populateStatics(characterId, section.get('statistics'));
                    populateSkills(characterId, section.get('statistics'));
                    populateNPC(characterId, cleanNotes);
                    populateSpecialAbilities(characterId, section.get('special'));

                    // Set up Token
                    var hitPoints = getAttribute(characterId, "HP-npc");
                    tokenLinkedToNpcCharacterSheet.set("bar1_link", hitPoints.id);
                    var armorClass = getAttribute(characterId, "EAC-npc");
                    tokenLinkedToNpcCharacterSheet.set("bar2_value", "EAC " + armorClass.get("current"));
                    tokenLinkedToNpcCharacterSheet.set("bar2_max", armorClass.get("current"));
                    armorClass = getAttribute(characterId, "KAC-npc");
                    tokenLinkedToNpcCharacterSheet.set("bar3_value", "KAC " + armorClass.get("current"));
                    tokenLinkedToNpcCharacterSheet.set("bar3_max", armorClass.get("current"));
                    tokenLinkedToNpcCharacterSheet.set("showname", true);

                    // Done
                    speakAsGuidanceToGM(characterSheet.get("name") + " NPC character sheet processed");
                });
            }

        } catch (ex) {
            speakAsGuidanceToGM("Hmm... I'm afraid I can't do that.");
            log(ex);
        }
    });

    var getAttribute = function (characterId, attributeName) {
        return findObjs({
            _characterid: characterId,
            _type: "attribute",
            name: attributeName
        })[0];
    };

    var parseBlockIntoSubSectionMap = function (textToParse) {
        let sections = new Map();
        var parsedText = textToParse;

        sections.set('header', parsedText.substring(0, parsedText.indexOf("DEFENSE")));
        parsedText = parsedText.substring(parsedText.indexOf("DEFENSE"));

        sections.set('defense', parsedText.substring(0, parsedText.indexOf("OFFENSE")));
        parsedText = parsedText.substring(parsedText.indexOf("OFFENSE"));

        sections.set('offense', parsedText.substring(0, parsedText.indexOf("STATISTICS")));
        parsedText = parsedText.substring(parsedText.indexOf("STATISTICS"));


        if (textToParse.includes("SPECIAL ABILITIES")) {
            sections.set('statistics', parsedText.substring(0, parsedText.indexOf("SPECIAL ABILITIES")));
            parsedText = parsedText.substring(parsedText.indexOf("SPECIAL ABILITIES"));
            sections.set('special', parsedText);
        } else {
            sections.set('statistics', parsedText);
        }

        return sections;
    };

    // Populate data
    var doSpells = function (characterId, textToParse) {

        /*
            {"name":"spellclass-0-level-0-spells-per-day","current":"0","max":"","_id":"-MSQLevfVkpkUIV3jQc4","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_lvl-0-spells_-MSQLfpe27uVyyBwNnwQ_name","current":"name","max":"","_id":"-MSQLgZ9p_0EAqLQ2vGs","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_lvl-0-spells_-MSQLfpe27uVyyBwNnwQ_school","current":"school","max":"","_id":"-MSQLgx8bKKficHqcnrQ","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_lvl-0-spells_-MSQLfpe27uVyyBwNnwQ_cast-time","current":"time","max":"","_id":"-MSQLhVtHt66attFm-ZC","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_lvl-0-spells_-MSQLfpe27uVyyBwNnwQ_range","current":"range","max":"","_id":"-MSQLiExnSE1y8CcXmgp","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_lvl-0-spells_-MSQLfpe27uVyyBwNnwQ_save","current":"save","max":"","_id":"-MSQLiy6Mq5OxKCfTsNy","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_lvl-0-spells_-MSQLfpe27uVyyBwNnwQ_description","current":"descriptioon","max":"","_id":"-MSQLjhL0-BLB_WS9IIr","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_lvl-0-spells_-MSQLfpe27uVyyBwNnwQ_macro-text-show","current":"1","max":"","_id":"-MSQLjvAii7lArFZTg9W","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}

            {"name":"repeating_npc-spell-like-abilities_-MTBzZdAnqmpvdtzBKN-_npc-abil-usage","current":"poop","max":"","_id":"-MTBzauNp8uusSPu9-q7","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_npc-spell-like-abilities_-MTBzZdAnqmpvdtzBKN-_npc-abil-name","current":"name","max":"","_id":"-MTBzbFi7uqlABcOZXNk","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_npc-spell-like-abilities_-MTBzZdAnqmpvdtzBKN-_npc-abil-duration","current":"dura","max":"","_id":"-MTBzbb_7LMvlUzn4gKX","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_npc-spell-like-abilities_-MTBzZdAnqmpvdtzBKN-_npc-abil-range","current":"rng","max":"","_id":"-MTBzbvKQOQL2d8SEpQv","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_npc-spell-like-abilities_-MTBzZdAnqmpvdtzBKN-_npc-abil-save","current":"DC","max":"","_id":"-MTBzcny33uzuRNIqI4P","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
            {"name":"repeating_npc-spell-like-abilities_-MTBzZdAnqmpvdtzBKN-_npc-abil-sr","current":"Yes","max":"","_id":"-MTBzd8WHQMRBwU9lDMe","_type":"attribute","_characterid":"-MSL5VzUk4EQpKd96CXr"}
        */
        speakAsGuidanceToGM("I'm not yet able to parse Spells and Spell-Like Abilities");
    };

    var addSpell = function (characterId, textToParse) {

    };

    var addSpellLikeAbility = function (characterId, textToParse) {

    };

    var cleanText = function (textToClean) {
        return textToClean.replace(/(<([^>]+)>)/gi, " "
        ).replace(/&nbsp;/gi, " "
        ).replace(/\s+/g, ' '
        ).replace(/Offense/i, " OFFENSE "
        ).replace(/Defense/i, " DEFENSE "
        ).replace(/Statistics/i, " STATISTICS "
        ).replace(/Ecology/i, "ECOLOGY "
        ).replace(/Special Abilities/i, " SPECIAL ABILITIES "
        ).replace(/Tactics/i, " TACTICS "
        ).replace(/ Str /i, " Str "
        ).replace(/ Dex /i, " Dex "
        ).replace(/ Con /i, " Con "
        ).replace(/ Int /i, " Int "
        ).replace(/ Wis /i, " Wis "
        ).replace(/ Cha /i, " Cha "
        );
    };

    var populateHeader = function (characterId, textToParse) {
        setAttribute(characterId, "npc-cr", getValue("CR", textToParse));
        setAttribute(characterId, "npc-XP", getValue("XP", textToParse).replace(/\s/, ""));
        setAttribute(characterId, "npc-senses", getValue("Senses", textToParse, ";"));
    };

    var populateDefense = function (characterId, textToParse) {
        setAttribute(characterId, "EAC-npc", getValue("EAC", textToParse));
        setAttribute(characterId, "KAC-npc", getValue("KAC", textToParse));
        setAttribute(characterId, "Fort-npc", getValue("Fort", textToParse));
        setAttribute(characterId, "Ref-npc", getValue("Ref", textToParse));
        setAttribute(characterId, "Will-npc", getValue("Will", textToParse));
        setAttribute(characterId, "HP-npc", getValue("HP", textToParse));
        setAttribute(characterId, "RP-npc", getValue("RP", textToParse));
        setAttribute(characterId, "npc-SR", getValue("SR", textToParse));
        setAttribute(characterId, "npc-resistances", getValue("Resistances", textToParse, ";"));
        setAttribute(characterId, "npc-DR", getValue("DR", textToParse, ";"));

        if (textToParse.includes("SR")) {
            setAttribute(characterId, "npc-immunities", getValue("Immunities", textToParse, "SR"));
        } else {
            setAttribute(characterId, "npc-immunities", getValue("Immunities", textToParse, "OFFENSE"));
        }

        var defensiveAbilities = "";
        if (textToParse.includes("vs.")) {
            var extraSaveStart = textToParse.indexOf("Will") + 3;
            defensiveAbilities = textToParse.substr(extraSaveStart);
            extraSaveStart = defensiveAbilities.indexOf(";");
            defensiveAbilities = defensiveAbilities.substr(extraSaveStart + 1);
            if (defensiveAbilities.includes("Defensive")) {
                defensiveAbilities = defensiveAbilities.substring(0, defensiveAbilities.indexOf("Defensive"));
            }
        }
        if (textToParse.includes("Defensive")) {
            var start = textToParse.indexOf("Defensive Abilities") + "Defensive Abilities".length;
            if (textToParse.includes("Immunities")) {
                textToParse = textToParse.substring(0, textToParse.indexOf("Immunities"));
            }
            defensiveAbilities = textToParse.substring(start) + " " + defensiveAbilities;
        }
        setAttribute(characterId, "npc-defensive-abilities", defensiveAbilities);
    };

    var populateOffense = function (characterId, textToParse) {
        setAttribute(characterId, "npc-special-attacks", getValue("Offensive Abilities", textToParse, "STATISTICS"));

        setAttribute(characterId, "speed-base-npc", getMovement("Speed", textToParse));
        setAttribute(characterId, "speed-fly-npc", getMovement("fly", textToParse));
        setAttribute(characterId, "speed-burrow-npc", getMovement("burrow", textToParse));
        setAttribute(characterId, "speed-climb-npc", getMovement("climb", textToParse));
        setAttribute(characterId, "speed-swim-npc", getMovement("swim", textToParse));
        setAttribute(characterId, "space", getMovement("Space", textToParse));
        setAttribute(characterId, "reach", getMovement("Reach", textToParse));

        if (textToParse.toLowerCase().includes("fly")) {
            if (textToParse.includes("(Ex")) {
                setAttribute(characterId, "speed-fly-source-npc", 1);
            } else if (textToParse.includes("(Su")) {
                setAttribute(characterId, "speed-fly-source-npc", 2);
            } else {
                setAttribute(characterId, "speed-fly-source-npc", 3);
            }

            if (textToParse.includes("lumsy)")) {
                setAttribute(characterId, "speed-fly-maneuverability-npc", -8);
            } else if (textToParse.includes("erfect)")) {
                setAttribute(characterId, "speed-fly-maneuverability-npc", 8);
            } else {
                setAttribute(characterId, "speed-fly-maneuverability-npc", 0);
            }
        }

        doWeapons(characterId, textToParse);
        doSpells(characterId, textToParse);
    };

    var getMovement = function (textToFind, textToParse) {
        if (textToParse.includes(textToFind)) {
            return getStringValue(textToFind, textToParse, "ft.").trim();
        }
        return "";
    }

    var populateStatics = function (characterId, textToParse) {
        setAttribute(characterId, "STR-bonus", getValue("Str", textToParse));
        setAttribute(characterId, "DEX-bonus", getValue("Dex", textToParse));
        setAttribute(characterId, "CON-bonus", getValue("Con", textToParse));
        setAttribute(characterId, "INT-bonus", getValue("Int", textToParse));
        setAttribute(characterId, "WIS-bonus", getValue("Wis", textToParse));
        setAttribute(characterId, "CHA-bonus", getValue("Cha", textToParse));
        setAttribute(characterId, "languages-npc", getValue("Languages", textToParse, "Other"));
        setAttribute(characterId, "npc-gear", getValue("Gear", textToParse, "Ecology"));
        setAttribute(characterId, "SQ", getValue("Other Abilities", textToParse, "Gear"));
    };

    var populateSpecialAbilities = function (characterId, textToParse) {
        log("Parsing Special Abilities");
        textToParse = textToParse.replace("SPECIAL ABILITIES", "").trim();
        if (textToParse != null) {
            if (textToParse.includes("(")) {
                do {
                    var uuid = generateRowID();
                    var abilityName = textToParse.substring(0, textToParse.indexOf(")") + 1);
                    setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-name", abilityName);
                    textToParse = textToParse.substring(textToParse.indexOf(")") + 1);
                    var nextAbility = textToParse.match(/(\..*?\()/);
                    if (nextAbility == null) {
                        setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse);
                        speakAsGuidanceToGM("Warning: There may be errors with Special Abilities due to extraneous parenthesis. You may wish to double check");
                        return;
                    }
                    var endPoint = textToParse.indexOf(nextAbility[0]) + 1;
                    setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.substring(0, endPoint));
                    textToParse = textToParse.substring(endPoint);
                } while (textToParse.includes("("));
            } else {
                var uuid = generateRowID();
                setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-name", "Special Abilities");
                textToParse = textToParse.replace(/\./g, ".\n");
                setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse);
            }
        }
    };

    var populateSkills = function (characterId, textToParse) {
        setAttribute(characterId, "Acrobatics-npc-misc", getSkillValue("Acrobatics", "Dex", textToParse));
        setAttribute(characterId, "Athletics-npc-misc", getSkillValue("Athletics", "Str", textToParse));
        setAttribute(characterId, "Bluff-npc-misc", getSkillValue("Bluff", "Cha", textToParse));
        setAttribute(characterId, "Computers-npc-misc", getSkillValue("Computers", "Int", textToParse));
        setAttribute(characterId, "Culture-npc-misc", getSkillValue("Culture", "Int", textToParse));
        setAttribute(characterId, "Diplomacy-npc-misc", getSkillValue("Diplomacy", "Cha", textToParse));
        setAttribute(characterId, "Disguise-npc-misc", getSkillValue("Disguise", "Cha", textToParse));
        setAttribute(characterId, "Engineering-npc-misc", getSkillValue("Engineering", "Int", textToParse));
        setAttribute(characterId, "Intimidate-npc-misc", getSkillValue("Intimidate", "Cha", textToParse));
        setAttribute(characterId, "Life-Science-npc-misc", getSkillValue("Life-Science", "Int", textToParse));
        setAttribute(characterId, "Medicine-npc-misc", getSkillValue("Medicine", "Int", textToParse));
        setAttribute(characterId, "Mysticism-npc-misc", getSkillValue("Mysticism", "Wis", textToParse));
        setAttribute(characterId, "Physical-Science-npc-misc", getSkillValue("Physical-Science", "Int", textToParse));
        setAttribute(characterId, "Piloting-npc-misc", getSkillValue("Piloting", "Dex", textToParse));
        setAttribute(characterId, "Sense-Motive-npc-misc", getSkillValue("Sense-Motive", "Wis", textToParse));
        setAttribute(characterId, "Sleight-of-Hand-npc-misc", getSkillValue("Sleight-of-Hand", "Dex", textToParse));
        setAttribute(characterId, "Stealth-npc-misc", getSkillValue("Stealth", "Dex", textToParse));
        setAttribute(characterId, "Survival-npc-misc", getSkillValue("Survival", "Wis", textToParse));
    };

    // Everything Else that needs more detail
    var populateNPC = function (characterId, textToParse) {
        setAttribute(characterId, "Perception-npc-misc", getSkillValue("Perception", "Wis", textToParse));
        setAttribute(characterId, "npc-init-misc", getSkillValue("Init", "Dex", textToParse));

        try {
            var section = getStringValue("XP", textToParse, "DEFENSE").trim();
            var subsections = section.split(' ');

            if (section.includes("LG")) {
                setAttribute(characterId, "npc-alignment", "LG");
            } else if (section.includes("NG")) {
                setAttribute(characterId, "npc-alignment", "NG");
            } else if (section.includes("CG")) {
                setAttribute(characterId, "npc-alignment", "CG");
            } else if (section.includes("LN")) {
                setAttribute(characterId, "npc-alignment", "LN");
            } else if (section.includes("CN")) {
                setAttribute(characterId, "npc-alignment", "CN");
            } else if (section.includes("LE")) {
                setAttribute(characterId, "npc-alignment", "LE");
            } else if (section.includes("NE")) {
                setAttribute(characterId, "npc-alignment", "NE");
            } else if (section.includes("CE")) {
                setAttribute(characterId, "npc-alignment", "CE");
            } else {
                setAttribute(characterId, "npc-alignment", "N");
            }

            var subtypeStart = 0;
            if (section.includes("Medium")) {
                dropdown = 0;
                subtypeStart = section.indexOf("Medium") + "Medium".length;
            } else if (section.includes("Large")) {
                dropdown = -1;
                subtypeStart = section.indexOf("Large") + "Large".length;
            } else if (section.includes("Small")) {
                dropdown = 1;
                subtypeStart = section.indexOf("Small") + "Small".length;
            } else if (section.includes("Gargantuan")) {
                dropdown = -4;
                subtypeStart = section.indexOf("Gargantuan") + "Gargantuan".length;
            } else if (section.includes("Huge")) {
                dropdown = -2;
                subtypeStart = section.indexOf("Huge") + "Huge".length;
            } else if (section.includes("Tiny")) {
                dropdown = 2;
                subtypeStart = section.indexOf("Tiny") + "Tiny".length;
            } else if (section.includes("Diminutive")) {
                dropdown = 4;
                subtypeStart = section.indexOf("Diminutive") + "Diminutive".length;
            } else if (section.includes("Fine")) {
                dropdown = 8;
                subtypeStart = section.indexOf("Fine") + "Fine".length;
            } else if (section.includes("Colossal")) {
                dropdown = -8;
                subtypeStart = section.indexOf("Colossal") + "Colossal".length;
            }

            setAttribute(characterId, "npc-size", dropdown);
            setAttribute(characterId, "npc-subtype", section.substring(subtypeStart, section.indexOf("Init")));
        } catch (err) {
            log("Problems with alignment, size,subtype");
        }
    };

    var doWeapons = function (characterId, textToParse) {
        var delimiter = "~~~";
        textToParse = textToParse.replace(/Attacks/i, ""
        ).replace(/ or /g, delimiter
        ).replace(/Ranged/g, delimiter
        ).replace(/Melee/g, delimiter
        ).replace(/OFFENSE/, "");

        if (textToParse.indexOf("Space") > 0) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Space"));
        }

        if (textToParse.indexOf("Spell") > 0) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Spell"));
        }

        if (textToParse.includes("Speed")) {
            textToParse = textToParse.substring(textToParse.indexOf("ft"));
        }

        if (textToParse.includes("fly")) {
            textToParse = textToParse.substring(textToParse.indexOf("fly"));
            textToParse = textToParse.substring(textToParse.indexOf("ft.") + 3).trim();
            if (textToParse.startsWith("(")) {
                textToParse = textToParse.substring(textToParse.indexOf(")") + 1).trim();
            }
        }

        if (textToParse.indexOf("Offensive Abilities") > 0) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Offensive Abilities"));
        }

        var attacks = textToParse.split(delimiter);
        for (attack of attacks) {
            attack = attack.trim();
            if (attack.length > 1) {
                if (!(attack.startsWith("Space") || attack.startsWith("Reach"))) {
                    try {
                        armNPC(characterId, attack);
                    } catch (err) {
                        speakAsGuidanceToGM("Could not populate data for weapon " + attack);
                    }
                }
            }

        }
    };

    var armNPC = function (characterId, attackToParse) {
        log("Parsing " + attackToParse);
        var uuid = generateRowID();

        var details = attackToParse.split(' ');
        var i = 0;
        var weapon = "";
        while (isNaN(details[i]) && i < details.length) {
            weapon = weapon + details[i] + " ";
            i++;
        }

        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-notes", attackToParse);
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-name", weapon);
        var attackBonus = details[i];
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-attack", attackBonus);
        i++;

        var damage = details[i].replace(/\(/, "");
        var numDice = damage.split('d');
        var dnd = numDice[1].split("+");
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-dice-num", numDice[0]);
        setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-damage-die", dnd[0]);

        if (dnd[1] != undefined) {
            setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-damage", dnd[1]);
        }
    };

    // borrowed from https://app.roll20.net/users/901082/invincible-spleen in the forums
    var setAttribute = function (characterId, attributeName, newValue, operator) {
        var mod_newValue = {
                "+": function (num) {
                    return num;
                },
                "-": function (num) {
                    return -num;
                }
            },

            foundAttribute = getAttribute(characterId, attributeName);
        try {
            if (!foundAttribute) {
                if (typeof operator !== 'undefined' && !isNaN(newValue)) {
                    log(newValue + " is a number.");
                    newValue = mod_newValue[operator](newValue);
                }

                log("DefaultAttributes: Initializing " + attributeName + " on character ID " + characterId + " with a value of " + newValue + ".");
                createObj("attribute", {
                    name: attributeName,
                    current: newValue,
                    max: newValue,
                    _characterid: characterId
                });
            } else {
                if (typeof operator !== 'undefined' && !isNaN(newValue) && !isNaN(foundAttribute.get("current"))) {
                    newValue = parseFloat(foundAttribute.get("current")) + parseFloat(mod_newValue[operator](newValue));
                }
                log("DefaultAttributes: Setting " + attributeName + " on character ID " + characterId + " to a value of " + newValue + ".");
                foundAttribute.set("current", newValue);
                foundAttribute.set("max", newValue);
                updateAll = false;
            }
        } catch (err) {
            log("Error parsing " + attributeName)
        }
    };

    // Parsing routines
    var getSkillValue = function (skillName, attribute, textToParse) {
        if (Number(getValue(skillName, textToParse).trim()) > 2) {
            log(skillName + " : " + getValue(skillName, textToParse) + " - " + attribute + " : " + getValue(attribute, textToParse));
            return Number(getValue(skillName, textToParse).trim()) - Number(getValue(attribute, textToParse).trim());
        }
        return 0;
    };

    var getValue = function (textToFind, textToParse, delimiter) {
        bucket = getStringValue(textToFind, textToParse, delimiter);
        return bucket.replace(";", "").replace("+", "").replace(",", " ").trim();
    };

    var getStringValue = function (textToFind, textToParse, delimiter) {
        if (textToParse.indexOf(textToFind) < 0) {
            return "";
        }
        var start = textToParse.indexOf(textToFind) + textToFind.length;
        if (start < 0) {
            return "";
        }
        var bucket = textToParse.substr(start);
        if (delimiter === undefined) {
            delimiter = " ";
        }
        bucket = bucket.trim();
        var end = bucket.toLowerCase().indexOf(delimiter.toLowerCase());
        if (end > 1) {
            bucket = bucket.substring(0, end);
        }
        return bucket;
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

    var speakAsGuidanceToGM = function (text) {
        sendChat("Guidance", "/w gm " + text);
    };
}
());