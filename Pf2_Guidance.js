var Guidance = Guidance || (function () {
    "use strict";

    const guidanceWelcome = "";
    const guidanceGreeting = "Greetings, I am Guidance. I am here to assist you working with your game. " +
        "To learn more, I created a welcome guide in the journal section.";

    const debugMode = true;

    // commands
    const prefix = "!sf_";
    const commandDebug = prefix + "debug";
    const commandHelp = prefix + "help";
    const commandToken = prefix + "token";
    const commandClean = prefix + "clean";
    const commandPopulate = prefix + "npc";

    //<editor-fold desc="Support Methods">
    class StrUtils extends String {
        constructor(s) {
            super(s);
            this.str = s;
        }

        firstMatch(regex) {
            let match = this.str.match(regex);
            if (match == null || match.length === 0 || match[0] == null || !Array.isArray(match)) {
                debugLog("firstItem: Not a valid array of strings");
                return "";
            }
            return match[0].trim();
        }

        substringFrom(delimit) {
            let index = this.str.toLowerCase().indexOf(delimit.toLowerCase());
            if (index === -1) {
                return "";
            }
            return this.substr(index + delimit.length);
        }
    }

    /// Class that represents a NPC/Starship that is being worked on.
    class NPC {
        constructor(characterId, token, characterSheet) {
            this.characterId = characterId;
            this.npcToken = token;
            this.characterSheet = characterSheet;
        }

        showContents() {
            debugLog("Character ID = " + this.characterId);
            debugLog("npcToken = " + this.npcToken);
        }
    }

    // Based on code from https://app.roll20.net/users/104025/the-aaron
    let generateUUID = (function () {
        let lastTimestamp = 0;
        let randomValues = [];

        return function () {
            let currentTimestamp = (new Date()).getTime();
            let duplicateTimestamp = currentTimestamp === lastTimestamp;
            lastTimestamp = currentTimestamp;

            let uuidArray = new Array(8);
            for (let i = 7; i >= 0; i--) {
                uuidArray[i] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(currentTimestamp % 64);
                currentTimestamp = Math.floor(currentTimestamp / 64);
            }

            let uuid = uuidArray.join("");

            if (duplicateTimestamp) {
                for (let i = 11; i >= 0 && randomValues[i] === 63; i--) {
                    randomValues[i] = 0;
                }
                randomValues[i]++;
            } else {
                for (let i = 0; i < 12; i++) {
                    randomValues[i] = Math.floor(64 * Math.random());
                }
            }

            for (let i = 0; i < 12; i++) {
                uuid += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(randomValues[i]);
            }

            return uuid;
        };
    })();

    let generateRowID = function () {
        return generateUUID().replace(/_/g, "Z");
    };

    let debugLog = function (text) {
        let timestamp = new Date().toUTCString();
        let stackTrace = new Error().stack.split("\n");
        log(`${timestamp} ${stackTrace[2].trim()} ${text}`);
    };

    let getAttribute = function (characterId, attributeName) {
        return findObjs({
            _characterid: characterId,
            _type: "attribute",
            name: attributeName
        })[0];
    };

    let debugCharacterDetails = function (character) {
        let attributes = findObjs({
            _characterid: character.characterId,
            _type: "attribute",
        });
        for (const att of attributes) {
            log("{\"name\":" + att.get("name") + "\"," +
                "\"current\":\"" + att.get("current") + "\"," +
                "\"max\":\"" + att.get("max") + "\"}");
        }

        let abilities = findObjs({
            _characterid: character.characterId,
            _type: "ability",
        });
        for (const ab of abilities) {
            debugLog(ab.get("name"));
        }
    };

    // borrowed from https://app.roll20.net/users/901082/invincible-spleen in the forums
    let setAttribute = function (characterId, attributeName, newValue, operator) {
        if (!attributeName || !newValue) {
            return;
        }

        let foundAttribute = getAttribute(characterId, attributeName);
        let mod_newValue = {
            "+": function (num) {
                return num;
            },
            "-": function (num) {
                return -num;
            }
        };

        try {
            if (!foundAttribute) {
                if (typeof operator !== "undefined" && !isNaN(newValue)) {
                    newValue = mod_newValue[operator](newValue);
                }

                if (attributeName.includes("show")) {
                    return;
                }

                if (newValue === undefined || newValue === "" || newValue === 0) {
                    return;
                }

                createObj("attribute", {
                    name: attributeName,
                    current: newValue,
                    max: newValue,
                    _characterid: characterId
                });
                debugLog("DefaultAttributes: Initializing " + attributeName + " on character ID " + characterId + " with a value of " + newValue + ".");
            } else {
                if (typeof operator !== "undefined" && !isNaN(newValue) && !isNaN(foundAttribute.get("current"))) {
                    newValue = parseFloat(foundAttribute.get("current")) + parseFloat(mod_newValue[operator](newValue));
                }

                foundAttribute.set("current", newValue);
                foundAttribute.set("max", newValue);
                debugLog("DefaultAttributes: Setting " + attributeName + " on character ID " + characterId + " to a value of " + newValue + ".");
            }
        } catch (err) {
            debugLog("Error parsing " + attributeName);
        }
    };

    let getSelectedNPCs = function (selected) {
        let npcs = [];
        for (const t of selected) {
            debugLog(t + "adding");
            let token = findObjs(t)[0];
            let cid = token.get("represents");
            npcs.push(new NPC(cid, token, findObjs({_id: cid, _type: "character"})[0]));
        }
        return npcs;
    };

    let speakAsGuidanceToGM = function (text) {
        text = "/w gm  &{template:default} {{name=Guidance}} {{" + text + "}}";
        sendChat("Guidance", text);
    };

    let toTitleCase = function (str) {
        str = str.toLowerCase().split(' ');
        for (let i = 0; i < str.length; i++) {
            str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
        }
        return str.join(' ');
    }

    let cleanText = function (textToClean) {
        return textToClean
            .replaceAll("</p>", "~")
            .replace(/(<([^>]+)>)/gi, " ")
            .replace(/&nbsp;|&amp;/gi, " ")
            .replace(/(Offense|Defense|Statistics)/gi, function (match) {
                return match.toUpperCase() + " ";
            })
            .replace(/(Ecology|Special Abilities|Tactics)/gi, function (match) {
                return match.toUpperCase() + " ";
            })
            .replace(/(Str|Dex|Con|Int|Wis|Cha)/gi, function (match) {
                return match.toUpperCase() + " ";
            });
    };

    // For Debugging purposes
    let isNullOrUndefined = function (v) {
        if (v == null) { // null or undefined
            debugLog(v === null ? "null" : "undefined");
            debugLog(new Error().stack);
            return true;
        }
        return false;
    };
    //</editor-fold>

    //<editor-fold desc="on(ready) event">
    on("ready", function () {
        speakAsGuidanceToGM(guidanceGreeting);

        let handoutName = "Welcome To Guidance";
        let objs = findObjs({name: handoutName, _type: "handout"});
        let userGuide;
        if (objs.length < 1) {
            userGuide = createObj("handout", {
                name: handoutName
            });
        } else {
            userGuide = objs[0];
        }
        userGuide.set("notes", guidanceWelcome);
    });
    //</editor-fold>

    on("chat:message", function (chatMessage) {
        if (chatMessage.type !== "api" || !playerIsGM(chatMessage.playerid)) {
            return;
        }

        let chatAPICommand = chatMessage.content;

        if (chatMessage.selected === undefined) {
            speakAsGuidanceToGM("Please select a token representing a character for me to work with");
            return;
        }

        let selectedNPCs = getSelectedNPCs(chatMessage.selected);

        if (debugMode) {
            debugLog(chatAPICommand);
        }

        try {
            //<editor-fold desc="commandHelp - Show Help information for using Guidance">
            if (chatAPICommand.startsWith(commandHelp)) {
                speakAsGuidanceToGM(guidanceWelcome);
                return;
            }
            //</editor-fold>

            //<editor-fold desc="commandClean - Erase All Information on a character sheet">
            if (chatAPICommand.startsWith(commandClean)) {
                if (selectedNPCs.length > 1) {
                    speakAsGuidanceToGM("Please do not select more than 1 NPC at a time. This command is potentially dangerous.");
                    return;
                }
                let selectedNPC = selectedNPCs[0];
                if (chatAPICommand.includes("CONFIRM")) {
                    eraseCharacter(selectedNPC);
                    speakAsGuidanceToGM("Removed all properties for " + selectedNPC.characterSheet.get("name"));
                } else {
                    speakAsGuidanceToGM("Check usage for !sf_clean");
                }
                return;
            }
            //</editor-fold>

            //<editor-fold desc="commandDebug - Show Debug information for character linked to Token">
            if (chatAPICommand.startsWith(commandDebug)) {
                selectedNPCs.forEach(debugCharacterDetails);

                let macros = findObjs({
                    _type: "macro",
                });
                for (const ab of macros) {
                    debugLog(ab.get("name"));
                    debugLog(ab.get("action"));
                }
                return;
            }
            //</editor-fold>

            //<editor-fold desc="commandToken - Configure Token linked to Sheet">
            if (chatAPICommand.startsWith(commandToken)) {
                selectedNPCs.forEach(configureToken);
                return;
            }
            //</editor-fold>

            //<editor-fold desc="commandPopulate - Populate NPC Character Sheet">
            if (chatAPICommand.startsWith(commandPopulate)) {
                selectedNPCs.forEach(function (c) {
                    c.characterSheet.get("gmnotes", function (gmNotes) {
                        if (!gmNotes.includes("Will")
                            && !gmNotes.includes("Fort")
                            && !gmNotes.includes("Ref")) {
                            speakAsGuidanceToGM("This does not appear to be a character statblock");
                            return;
                        }
                        populateCharacterSheet(gmNotes, c);
                        configureToken(c);
                    });
                });
                return;
            }
            //</editor-fold>

        } catch (err) {
            speakAsGuidanceToGM("I have encountered an error. If you can, please report this to the Script Creator.");
            debugLog(err);
        }
    });

    function populateStat(characterId, sb, stat, regex) {
        debugLog("Populating " + stat + " for " + characterId);
        debugLog(sb);
        let statBlock = new StrUtils(sb);
        let current = statBlock.firstMatch(regex);
        if (current === "") {
            return statBlock;
        }
        setAttribute(characterId, stat, current.trim());
        return statBlock.substringFrom(current);
    }

    let populateCharacterSheet = function (gmNotes, selectedNPC) {
        try {
            let characterId = selectedNPC.characterId;
            let npcToken = selectedNPC.npcToken;
            let characterSheet = selectedNPC.characterSheet;

            let cleanNotes = cleanText(gmNotes);
            debugLog(cleanNotes);

            npcToken.set("gmnotes", cleanNotes);

            let statBlock = new StrUtils(cleanNotes);

            let current = statBlock.firstMatch(/.*?(?=\s+Creature)/i);
            characterSheet.set("name", current);
            setAttribute(characterId, "npc_type", "Creature");

            statBlock = statBlock.substringFrom("Creature");
            setAttribute(characterId, "sheet_type", "npc");

            statBlock = populateStat(characterId, statBlock, "level", /^(\-\d+|\d+)/si);
            statBlock = populateStat(characterId, statBlock, "rarity", /^.*?(?=(LG|NG|CG|LN|N|CN|LE|NE|CE))/si);
            statBlock = populateStat(characterId, statBlock, "alignment", /^.*?(LG|NG|CG|LN|N|CN|LE|NE|CE)/si);
            statBlock = populateStat(characterId, statBlock, "size", /^.*?(Fine|Diminutive|Tiny|Small|Medium|Large|Huge|Gargantuan|Colossal)/si);
            statBlock = populateStat(characterId, statBlock, "traits", /^.*?(?=Source|Perception)/si);
            statBlock = populateStat(characterId, statBlock, "source", /^.*?(?=Perception)/si);
            populateStat(characterId, statBlock, "perception", /(?<=Perception).*?(?=;)/si);
            statBlock = populateStat(characterId, statBlock, "npc_perception", /(?<=Perception).*?(?=;)/si);
            statBlock = populateStat(characterId, statBlock, "senses", /(?<=;\s).*?(?=\sSkills|\sLanguages)/si);
            statBlock = populateStat(characterId, statBlock, "languages", /(?<=Languages\s).*?(?=\sSkills)/si);
            statBlock = new StrUtils(statBlock).substringFrom("Skills");

            let argArray = ["Acrobatics", "Arcana", "Athletics", "Crafting", "Deception", "Diplomacy", "Intimidation",
                "Lore", "Medicine", "Nature", "Occultism", "Performance", "Religion", "Society", "Stealth", "Survival",
                "Thievery"];
            argArray.forEach(skill => {
                let re = new RegExp(`(?<=${skill}\\s).*?(?=,|\\sStr)`, 'gi');
                populateStat(characterId, statBlock, skill.toLowerCase(), re);
                statBlock = populateStat(characterId, statBlock, "npc_" + skill.toLowerCase(), re);
            });

            argArray = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
            argArray.forEach(stat => {
                let s = stat.substring(0, 3);
                let re = new RegExp(`(?<=${s}\\s).*?(?=,|\\s+)`, 'gi');
                statBlock = populateStat(characterId, statBlock, stat.toLowerCase() + "_modifier", re);
            });

            // Interaction Abilities
            if (!statBlock.trim().startsWith("Items") && !statBlock.trim().startsWith("AC")) {
                let interactionAbilities = new StrUtils(statBlock).firstMatch(/.*?(?=AC|Items)/si);
                let interactionArray = [];

                interactionArray.forEach(item => {
                    let rowId = generateRowID();
                    let attributeName = "repeating_interaction-abilities_-" + rowId + "_";
                    setAttribute(characterId, attributeName + "_name", item.trim());
                    setAttribute(characterId, attributeName + "_toggles", "display,");
                });
            }

            // Items
            if (statBlock.trim().startsWith("Items")) {
                let items = new StrUtils(statBlock).firstMatch(/(?<=Items\s+).*(?=\sAC)/si);
                let itemsArray = items.split(",");

                itemsArray.forEach(item => {
                    let rowId = generateRowID();
                    let attributeName = "repeating_items-worn_-" + rowId + "_";
                    setAttribute(characterId, attributeName + "_worn_item", item.trim());
                    setAttribute(characterId, attributeName + "_toggles", "display,");
                });

            }

            statBlock = new StrUtils(statBlock).substringFrom("AC");


            debugLog(statBlock);
        } catch (e) {
            debugLog("Caught exception: " + e);
            speakAsGuidanceToGM("NPC Sheet Population Error");
        }
    }

    //<editor-fold desc="configureToken - link the token stats to the NPC sheet and show the name">
    let configureToken = function (selectedNPC) {
        try {
            let characterId = selectedNPC.characterId;
            let npcToken = selectedNPC.npcToken;
            let characterSheet = selectedNPC.characterSheet;
            let hitPoints = getAttribute(characterId, "hit_points");
            let armorClass = getAttribute(characterId, "ac");

            debugLog("Configuring token for " + characterId + " - " + characterSheet.get("name"));
            npcToken.set("showname", true);
            npcToken.set("bar3_link", armorClass.id);
            npcToken.set("bar1_link", hitPoints.id);
        } catch (e) {
            debugLog("Caught exception: " + e);
            speakAsGuidanceToGM("Token Configuration Error - Check to make sure the tokens are linked to the selected NPCs.");
        }
    };
    //</editor-fold>

    //<editor-fold desc="eraseCharacter - Remove all Attributes and Macros from the NPC sheet">
    let eraseCharacter = function (c) {
        c.characterSheet.set("name", "Erased Character");
        for (const attribute of findObjs({_characterid: c.characterId, _type: "attribute"})) {
            debugLog("Removing " + attribute.get("name"));
            attribute.remove();
        }
        for (const ability of findObjs({_characterid: c.characterId, _type: "ability"})) {
            debugLog("Removing " + ability.get("name"));
            ability.remove();
        }
        for (let i = 1; i < 4; i++) {
            c.npcToken.set("bar" + i + "_value", "");
            c.npcToken.set("bar" + i + "_max", "");
        }
    }
    //</editor-fold>
}
());