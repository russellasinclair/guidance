var Guidance = Guidance || (function () {
    "use strict";

    const guidanceWelcome = "<p>This is a tool to support the usage of the Starfinder character sheets in Roll20. It has the ability to read a statblock from the GMNotes section of a selected character and fill out the NPC section of the charactersheet. Statblocks from Archives of Nethys and Starjammer SRD are supported. Statblocks from PDFs can be used, but there may be parsing issues.</p> <p>&nbsp;</p> <h2>THE MAIN COMMANDS</h2> <p>&nbsp;</p> <p><em><strong>!sf_character</strong></em></p> <p>This imports a Starfinder statblock in the GM Notes section of a character sheet and will out the NPC section of the Starfinder (Simple) character sheet. Furthermore, it configures the token's hit points and give EAC/KAC indicators.</p> <p><em>How to:</em></p> <ol> <li>Select and copy a stat block and paste it into the \"GM Notes\" section of a Character sheet. (Don't worry about removing any formatting)</li> <li>Click Save.</li> <li>Select the token that you have<a href=\"https://wiki.roll20.net/Linking_Tokens_to_Journals\"> linked to the character sheet</a>.</li> <li>Type !sf_character. The script attempts to use the statblock to fill out the NPC section of the Starfinder (Simple) character sheet.</li> </ol> <p>The script supports character statblocks from the <a href=\"https://www.aonsrd.com/Default.aspx\">Archives of Nethys</a> and the <a href=\"https://www.starjammersrd.com/\">Starjammer SRD</a>. <span style=\"font-style: italic;\">Society PDFs, at least in the earlier ones, sometimes present issues. Double check the results after importing a statblock from a PDF.</span></p> <p>&nbsp;</p> <p><strong><span style=\"font-style: italic;\">!sf_starship</span></strong></p> <p>This imports a Starfinder starship statblock from the GM Notes section of a <a href=\"https://wiki.roll20.net/Linking_Tokens_to_Journals\">linked character sheet</a> and populates the Starship page of the sheet. Furthermore, It adds gunnery and piloting check macros. If the statblock doesn&rsquo;t have stats for the pilot/gunner, the script adds prompts so that when you click the macro, you are prompted for the bonus.</p> <p>This works the same as !sf_character but in practice, statblocks for starships are less consistent across platforms.</p> <p>&nbsp;</p> <p><em><strong>!sf_token</strong></em></p> <p>This populates the token with hitpoint, EAC, and KAC information in the event that the NPC sheet is setup, but the token isn't. The token will look like the one produced by !sf_character</p> <p>&nbsp;</p> <p><em><strong>!sf_clean</strong></em></p> <p>I've included this for completeness, but be warned - this command will <span style=\"text-decoration: underline;\"><strong>PERMANENTLY ERASE</strong></span> things from the character sheet so use with caution. As above, this command requires selecting a token that has been <a href=\"https://wiki.roll20.net/Linking_Tokens_to_Journals\">linked to the character sheet</a>.</p> <p><em>How to:</em></p> <p style=\"padding-left: 40px;\"><em><strong>!sf_clean CONFIRM</strong></em> - This will erase ALL stats from the character sheet AND remove ALL formatting from the token. It will not touch the GM Notes section of the character sheet so it can be reimported using !sf_character.</p> <p style=\"padding-left: 40px;\"><strong><em>!sf_clean ABILITIES</em></strong> - This will rease ALL macros from the character sheet.</p> <p>&nbsp;</p> <h3>OTHER USEFUL COMMANDS</h3> <p><em><strong>!sf_init</strong></em></p> <p>This rolls group initiative for all selected NPCs. The script refers to the Initiative bonus on the NPC tab of the character sheet to do this.</p> <p>&nbsp;</p> <p><em><strong>!sf_addtrick</strong></em></p> <p>This adds a macro to handle Trick Attacks for the NPC. Click over to the main \"Character\" page, and configure Trick Attacks to make it work.</p> <p>&nbsp;</p> <h3>The next two commands will require creating a simple macro to run correctly</h3> <p>The macro will look like this.</p> <blockquote> <p style=\"padding-left: 40px;\">!sf_ability ?{textToPaste}</p> </blockquote> <p>&nbsp;</p> <p><em><strong>!sf_ability</strong></em></p> <p>This adds a special ability to the NPC character sheet for quick reference. If the macro has been created as described above, a box appears allowing you to paste the full text of a special ability.</p> <p>&nbsp;</p> <p><em><strong>!sf_addspell</strong></em></p> <p>This adds a spell to the NPC character sheet as a macro. Similar to sf_ability, when you run the macro to call this, a box appears allowing you to paste the full text of the spell. The script formats the spellblock. Afterwards, I recommend manually editing the macro in the \"description\" tag to tailor the results of the macro for use in play.</p> <p>&nbsp;</p> <p>Find other details on the wiki <a href=\"https://wiki.roll20.net/Script:Starfinder_-_Guidance_Tools_for_Starfinder_(Simple)_Character_sheet\">HERE</a>.</p> <p>Feel free to reach out to me if you find any bug or have any suggestions <a href=\"https://app.roll20.net/users/927625/kahn265\">HERE</a>.</p>";
    const guidanceGreeting = "Greetings, I am Guidance. I am here to assist you working with your Starfinder game to make " +
        "your time in the Pact Worlds more enjoyable. To learn more, I created a welcome guide in the journal section.";

    let debugMode = true;
    let simpleSheetUsed = false;
    let SkillList = [{name: "Acrobatics", attribute: "Dex"}, {name: "Athletics", attribute: "Str"}, {
        name: "Bluff",
        attribute: "Cha"
    }, {name: "Computers", attribute: "Int"}, {name: "Culture", attribute: "Int"}, {
        name: "Diplomacy",
        attribute: "Cha"
    }, {name: "Disguise", attribute: "Cha"}, {name: "Engineering", attribute: "Int"}, {
        name: "Intimidate",
        attribute: "Cha"
    }, {name: "Life-Science", attribute: "Int"}, {name: "Medicine", attribute: "Int"}, {
        name: "Mysticism",
        attribute: "Wis"
    }, {name: "Perception", attribute: "Wis"}, {name: "Physical-Science", attribute: "Int"}, {
        name: "Piloting",
        attribute: "Dex"
    }, {name: "Sense-Motive", attribute: "Wis"}, {name: "Sleight-of-Hand", attribute: "Dex"}, {
        name: "Stealth",
        attribute: "Dex"
    }, {name: "Survival", attribute: "Wis"}];

    let isEmpty = function (valueToCheck) {
        if (valueToCheck === null || valueToCheck === undefined || valueToCheck === "") {
            debugLog(valueToCheck === null ? "null" : "undefined");
            debugLog(new Error().stack);
            return true;
        }
        return false;
    }

    //<editor-fold desc="Support Methods"  defaultstate="collapsed" >
    let getFirstMatchingElement = function (source, regex, ignoreEmpty) {
        let match = getMatchingArray(source, regex, ignoreEmpty);
        if (match[0] == null) {
            if (isEmpty(ignoreEmpty)) {
                return "";
            }
            return source;
        }
        return match[0].trim();
    }

    let getMatchingArray = function (source, regex) {
        let match = source.match(regex);
        if (isEmpty(match) || match.length === 0 || !Array.isArray(match)) {
            debugLog("source=" + source + ", regex=" + regex + " didn't return an array");
            return [];
        }
        return match;
    }

    let getSubstringStartingFrom = function (source, delimit) {
        let index = source.toLowerCase().indexOf(delimit.toLowerCase());
        if (index === -1) {
            return "";
        }
        return source.substr(index + delimit.length).trim();
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
        //if (debugMode) {
        let timestamp = new Date().toUTCString();
        let stackTrace = new Error().stack.split("\n");
        log(`${timestamp} ${stackTrace[2].trim()} ${text}`);
        //}
    };

    function getAttribute(characterId, attributeName) {
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
    function setAttribute(characterId, attributeName, newValue, operator) {
        if (!attributeName || !newValue) {
            return;
        }
        debugLog("CALLING setAttribute(" + characterId + "," + attributeName + "," + newValue + "," + operator + ")")
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
            debugLog("ERROR PARSING setAttribute(" + characterId + "," + attributeName + "," + newValue + "," + operator + ")");
            log(err.message);
            log(err.stack);
        }
    };

    let getSelectedNPCs = function (selected) {
        let npcs = [];
        for (const t of selected) {
            debugLog(t);
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
            .replace(/(<([^>]+)>)/gi, " ")
            .replace(/&nbsp;|&amp;/gi, " ")
            .replace(/\s+/g, " ")
            .replace(/(Offense|Defense|Statistics)/gi, function (match) {
                return match.toUpperCase() + " ";
            })
            .replace(/(Ecology|Special Abilities|Tactics)/gi, function (match) {
                return match.toUpperCase() + " ";
            })
            .replace(/\b(Str|Dex|Con|Int|Wis|Cha)\b/gi, function (match) {
                return match.toUpperCase() + " ";
            });
    };

    let removeStartingDelimiters = function (statBlock) {
        statBlock = statBlock.trim();
        while (statBlock.startsWith(";") || statBlock.startsWith("~")) {
            if (statBlock.startsWith(";")) {
                statBlock = getSubstringStartingFrom(statBlock, ";");
            }
            if (statBlock.startsWith("~")) {
                statBlock = getSubstringStartingFrom(statBlock, "~");
            }
        }
        return statBlock;
    }

    let eraseCharacter = function (c) {
        for (const attribute of findObjs({_characterid: c.characterId, _type: "attribute"})) {
            //debugLog("Removing " + attribute.get("name"));
            attribute.remove();
        }
        for (const ability of findObjs({_characterid: c.characterId, _type: "ability"})) {
            //debugLog("Removing " + ability.get("name"));
            ability.remove();
        }
        for (let i = 1; i < 4; i++) {
            c.npcToken.set("bar" + i + "_value", "");
            c.npcToken.set("bar" + i + "_max", "");
        }

        debugLog("Removed all properties for " + c.characterSheet.get("name"));
        speakAsGuidanceToGM("Removed all properties for " + c.characterSheet.get("name"));
        //c.characterSheet.set("name", "Erased Character");
    }

    function populateStat(characterId, statBlock, regex, ...stats) {
        debugLog("Starting with = " + statBlock);
        debugLog("Trying to populate = " + stats.toString());
        let current = getFirstMatchingElement(statBlock, regex);
        statBlock = getSubstringStartingFrom(statBlock, current);
        statBlock = removeStartingDelimiters(statBlock);
        debugLog("returning = " + statBlock);

        if (current === "") {
            return statBlock;
        }
        current = current.replaceAll("~", "").trim();

        if (Array.isArray(stats)) {
            stats.forEach(stat => {
                setAttribute(characterId, stat, current);
            });
        } else {
            setAttribute(characterId, stats, current);
        }
        return statBlock;
    }

    //</editor-fold>

    //<editor-fold desc="on(ready) event"  defaultstate="collapsed" >
    on("ready", function () {
        speakAsGuidanceToGM(guidanceGreeting);

        let handoutName = "Welcome To Guidance";
        let objs = findObjs({name: handoutName, _type: "handout"});
        let userGuide;

        if (objs.length < 1) {
            let userGuide = createObj("handout", {
                name: handoutName
            });
            userGuide.set("notes", guidanceWelcome);
        } else {
            userGuide = objs[0];
        }
        debugMode = true;
        try {
            userGuide.get("gmnotes", function (gmNotes) {
                if (gmNotes.includes("debug")) {
                    debugMode = true;
                    speakAsGuidanceToGM("Debug Mode has been enabled");
                }
                if (gmNotes.includes("official")) {
                    simpleSheetUsed = false;
                    speakAsGuidanceToGM("The Roll20 official Starfinder sheet detected");
                } else {
                    simpleSheetUsed = false;
                    speakAsGuidanceToGM("The Starfinder (Simple) sheet set");
                }
            });
        } catch (err) {
            log(err.message);
            log(err.stack);
            log("First usage - can't read handout just yet.");
        }
    });

    //</editor-fold>

    on("chat:message", function (chatMessage) {
        if (chatMessage.type !== "api" || !playerIsGM(chatMessage.playerid)) {
            return;
        }

        if (chatMessage.content.startsWith("!sf_help")) {
            speakAsGuidanceToGM("I have several commands I support:<br><br>" +
                "<b><i>!sf_character</i></b> will allow you to take a Starfinder statblock that is in the GM notes section " +
                "of a selected character and I will attempt to use it to fill out the NPC section of the Starfinder " +
                "(Simple) character sheet. I support statblocks from the Archives of Nethys and the Starjammer SRD. " +
                "<i>I don't do well with Society PDFs</i>. If you want to attempt using one, double check my work.<br><br>" +
                "<b><i>!sf_clean CONFIRM</i></b> will allow me to take a selected character sheet and completely " +
                "<i>AND PERMANENTLY</i> remove all data from it. <i>I recommend against using this unless you are about " +
                "to reimport a character</i>.<br><br><b><i>!sf_token</i></b> will populate the token with hitpoint, " +
                "EAC, and KAC information in the event that the sheet is setup, but the token isn't.<br><br><b><i>" +
                "!sf_init</i></b> will roll group initiative for all selected NPCs<br><br><b><i>!sf_addtrick</i></b>" +
                "will add a macro to handle Trick Attacks for the NPC<br><br><b><i>!sf_starship</i></b> will allow you " +
                "to take a Starfinder starship statblock in the GM Notes section of a character sheet and populate it." +
                "Furthermore, I will add weapons and piloting check macros.<br><br><b><i>!sf_ability</i></b> will allow" +
                "me to add a special ability to the character sheet for quick reference. No macro is added<br><br><b>" +
                "<i>!sf_addspell</i></b> add a macro to display a formatted spell stat block for a spell. I recommend " +
                "editing the description of the new macro to display the appropriate rolls for the spell. ");
            return;
        }

        if (chatMessage.selected === undefined) {
            speakAsGuidanceToGM("Please select a token representing a character for me to work with");
            return;
        }

        let selectedNPCs = getSelectedNPCs(chatMessage.selected);

        try {
            identifyCharacterSheet(selectedNPCs[0]);

            if (chatMessage.content.startsWith("!sf_fixPlayer")) {
                selectedNPCs.forEach(function (c) {
                    let r = c.npcToken.get("represents");
                    if (isEmpty(r)) {
                        c.npcToken.set({statusmarkers: "dead"})
                        speakAsGuidanceToGM("I've marked unlinked tokens with a red X");
                        speakAsGuidanceToGM("Go into the settings for these tokens and set 'Represents Character' to the correct PC and rerun this command");
                    } else {
                        c.npcToken.set({
                            has_bright_light_vision: true,
                            emits_low_light: true,
                            emits_bright_light: true,
                            bright_light_distance: 5,
                            low_light_distance: 20,
                            showname: true,
                            showplayers_name: true,
                            playersedit_name: true,
                            controlledby: "all",
                            light_otherplayers: true,
                            width: 70,
                            height: 70
                        });
                        c.npcToken.set("dead", false);
                        log("Token Represents = " + c.npcToken.get("represents"));
                        log("Characterid = " + c.characterId);
                        log("SheetID = " + c.characterSheet.get("_id"));
                        setDefaultTokenForCharacter(c.characterSheet, c.npcToken);
                        speakAsGuidanceToGM("I've configured the token for " + c.characterSheet.get("name") + "'s player");
                        speakAsGuidanceToGM("I'm assuming their cellphones have flashlights and they are \"Medium\"");
                    }
                });
                return;
            }

            //<editor-fold desc="Roll Initiative for a group of NPCs">
            if (chatMessage.content.startsWith("!sf_init")) {
                speakAsGuidanceToGM("Rolling NPC initiative for all selected tokens");
                let turnorder = JSON.parse(Campaign().get("turnorder"));
                selectedNPCs.forEach(function (npc) {
                    npc.showContents();

                    let init = getAttribute(npc.characterId, "npc-init-misc");
                    if (init === undefined) {
                        init = 0;
                    } else {
                        init = init.get("current");
                    }
                    if (isEmpty(init) || isNaN(init)) {
                        init = 0;
                    }
                    debugLog("init " + init);

                    let dex = getAttribute(npc.characterId, "DEX-bonus");
                    if (dex === undefined) {
                        dex = 0;
                    } else {
                        dex = dex.get("current");
                    }
                    if (isEmpty(dex) || isNaN(dex)) {
                        init = 0;
                    }
                    debugLog("dex " + dex);

                    let roll = randomInteger(20);
                    speakAsGuidanceToGM(npc.characterSheet.get("name") + " rolls initiative<br><br>d20=" + roll + " + Dex=" + dex + " + Init=" + init);
                    roll = roll + parseFloat(dex) + parseFloat(init);

                    turnorder.push({
                        id: npc.npcToken.id,
                        pr: String(roll) + String(".0" + init),
                        custom: getAttribute(npc.characterId, "name")
                    });
                });
                Campaign().set("turnorder", JSON.stringify(turnorder));
                debugLog(JSON.stringify(turnorder));
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Wipe out all Character Data">
            if (chatMessage.content.startsWith("!sf_clean")) {
                let msg = chatMessage.content.replace("!sf_clean ", "");
                if (selectedNPCs.length > 1 && !debugMode) {
                    speakAsGuidanceToGM("Please do not select more than 1 NPC at a time. This command is potentially dangerous.");
                    return;
                }
                let c = selectedNPCs[0];
                debugLog("INCLUDES = " + msg);
                if (msg.includes("CONFIRM")) {
                    identifyCharacterSheet(c);
                    eraseCharacter(c);
                    if (debugMode) {
                        c.npcToken.set("gmnotes", "");
                    }

                    speakAsGuidanceToGM("Removed all properties for " + c.characterSheet.get("name"));
                    return;
                } else if (msg.includes("ABILITIES")) {
                    c.showContents();
                    for (let prop of findObjs({_characterid: c.characterId, _type: "ability"})) {
                        debugLog("Removing " + prop.get("name"));
                        prop.remove();
                    }
                    speakAsGuidanceToGM("Removed all abilities for " + c.characterSheet.get("name"));
                    return;
                }
                speakAsGuidanceToGM("Check usage for !sf_clean");
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Set up all selected Token">
            if (chatMessage.content.startsWith("!sf_token")) {
                selectedNPCs.forEach(function (c) {
                    identifyCharacterSheet(c);
                    setUpToken(c.characterId, c.npcToken);
                });
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Populate all selected Character Sheet">
            if (chatMessage.content.startsWith("!sf_character")) {
                selectedNPCs.forEach(function (c) {
                    c.characterSheet.get("gmnotes", function (gmNotes) {
                        if (!gmNotes.includes("Will")) {
                            speakAsGuidanceToGM("This does not appear to be a character statblock");
                            return;
                        }
                        eraseCharacter(c);
                        populateCharacterSheet(gmNotes, c);
                        setToken(c.characterSheet, c.npcToken);
                    });
                });
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Add Trick Attack to all selected Character Sheet">
            if (chatMessage.content.startsWith("!sf_addtrick")) {
                selectedNPCs.forEach(function (character) {
                    debugLog("Adding Trick Attack");
                    character.showContents();
                    createObj("ability", {
                        name: "Trick Attack (settings on main sheet)",
                        description: "",
                        action: "&{template:default}{{name=Trick Attack}}{{check=**CR**[[@{trick-attack-skill} - 20]]or lower }} {{foo=If you succeed at the check, you deal @{trick-attack-level} additional damage?{Which condition to apply? | none, | flat-footed, and the target is flat-footed | off-target, and the target is off-target | bleed, and the target is bleeding ?{How much bleed? &amp;#124; 1 &amp;#125; | hampered, and the target is hampered (half speed and no guarded step) | interfering, and the target is unable to take reactions | staggered, and the target is staggered (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | stun, and the target is stunned (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | knockout, and the target is unconscious for 1 minute (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates)} }} {{notes=@{trick-attack-notes}}}",
                        _characterid: character.characterId,
                    });
                    addSpecialAbilities(character.characterId, "Trick Attack (Ex) You can trick or startle a foe and then attack when she drops her guard. As a full action, you can move up to your speed. Whether or not you moved, you can then make an attack with a melee weapon with the operative special property or with any small arm. Just before making your attack, attempt a Bluff, Intimidate, or Stealth check (or a check associated with your specialization; see page 94) with a DC equal to 20 + your target’s CR. If you succeed at the check, you deal 1d4 additional damage and the target is flat-footed. This damage increases to 1d8 at 3rd level, to 3d8 at 5th level, and by an additional 1d8 every 2 levels thereafter. You can’t use this ability with a weapon that has the unwieldy special property or that requires a full action to make a single attack.");
                });
                speakAsGuidanceToGM("Trick attack added to selected character(s)");
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Populate Starship Character Sheet">
            if (chatMessage.content.startsWith("!sf_starship")) {
                selectedNPCs.forEach(function (c) {
                    c.characterSheet.get("gmnotes", function (gmNotes) {
                        if (!gmNotes.includes("TL")) {
                            speakAsGuidanceToGM("This does not appear to be a starship statblock");
                            return;
                        }
                        populateStarshipData(gmNotes, c);
                    });
                });
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Add Special Ability to Character sheet">
            if (chatMessage.content.startsWith("!sf_ability")) {
                let cleanNotes = chatMessage.content.replace("!sf_ability ", "");
                selectedNPCs.forEach(character => addSpecialAbilities(character.characterId, cleanNotes));
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Add a Spell to a character sheet as a macro">
            if (chatMessage.content.startsWith("!sf_addspell")) {
                try {
                    let c = selectedNPCs[0];
                    let cleanNotes = chatMessage.content.replace("!sf_addspell ", "");
                    if (!cleanNotes.toLowerCase().includes("classes")) {
                        speakAsGuidanceToGM("usage:<br>!sf_addspell ?{text}<br>Type that exactly, and a dialog will appear where you can past the full text of the spell.");
                        return;
                    }

                    cleanNotes = cleanNotes.replace("SFS Legal", "").trim();
                    let spellName = cleanNotes.substring(0, cleanNotes.indexOf("Source"));
                    let spell = parseStatBlock(getSpellStatBlocks(), cleanNotes);

                    spell.push(new TemplateRow(0, "name", spellName));

                    let spellText = formatSpellAsMacro(spell);
                    debugLog(spellText);
                    let name = getFirstMatchingElement(spellText, /(?<={{name=)(.*?)(?=}})/);

                    if (c.characterId !== undefined) {
                        createObj("ability", {
                            name: name + " spell",
                            description: "",
                            action: spellText,
                            _characterid: c.characterId,
                        });
                    }
                    speakAsGuidanceToGM("Spell has been added to " + c.characterSheet.get("name"));
                } catch (err) {
                    log(err.message);
                    log(err.stack);
                }
                return;
            }
            //</editor-fold>

            //<editor-fold desc="Code for Testing and Debugging">

            // Code for Testing and Debugging
            if (chatMessage.content.startsWith("!sf_debug")) {
                selectedNPCs.forEach(debugCharacterDetails);

                let character = selectedNPCs[0];
                identifyCharacterSheet(character);

                let ables = findObjs({
                    _characterid: character.characterId,
                    _type: "ability",
                });
                for (const ab of ables) {
                    debugLog(ab.get("name"));
                }

                let macros = findObjs({
                    _type: "macro",
                });
                for (const ab of macros) {
                    debugLog(ab.get("name"));
                    debugLog(ab.get("action"));
                }
            }
            //</editor-fold>

        } catch (err) {
            speakAsGuidanceToGM("I have encountered an error. If you can, please report this to the Script Creator.");
            log(err.message);
            log(err.stack);
        }
    });

    let massageTheDataForAbilityParsing = function (text) {
        return text;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    let populateCharacterSheet = function (gmNotes, selectedNPC) {
        const characterId = selectedNPC.characterId;
        const npcToken = selectedNPC.npcToken;
        const characterSheet = selectedNPC.characterSheet;

        let statBlock = cleanText(gmNotes).trim();

        try {
            if (debugMode) {
                selectedNPC.npcToken.set("gmnotes", statBlock);
            }

            setAttribute(characterId, "name", characterSheet.get("name"));

            let npcName = toTitleCase(getFirstMatchingElement(statBlock, /.*?(?=(XP|Level|CR).*\d+)/im));
            characterSheet.set("name", npcName);
            npcToken.set("name", npcName);
            simpleSheetUsed = true;

            if (simpleSheetUsed) {
                setAttribute(characterId, "tab", 4);
                setAttribute(characterId, "npc-race", characterSheet.get("name"));
                setAttribute(characterId, "npc-feats-show", 0);
                setAttribute(characterId, "npc-special-abilities-show", 1);
                setAttribute(characterId, "npc-gear-show", 0);
            } else {
                setAttribute(characterId, "sheet_type", "npc");
                setAttribute(characterId, "tab_select", "0");
            }

            //<editor-fold desc="Character Sheet Header">
            let workingSection = getFirstMatchingElement(statBlock, /.*?(?=DEFENSE)/);
            workingSection = populateStat(characterId, workingSection, /(?<=CR\s)\d+(\\\d)*?(?=\s*\w)/, "npc-cr", "character_level");
            populateStat(characterId, workingSection, /(?<=\s)(LG|NG|CG|LN|N|CN|LE|NE|CE)?(?=\s)/, "npc-alignment", "alignment");

            if (workingSection.toLowerCase().includes("fine")) {
                setAttribute(characterId, "npc-size", 8);
                setAttribute(characterId, "size", -4);
            } else if (workingSection.toLowerCase().includes("diminutive")) {
                setAttribute(characterId, "npc-size", 4);
                setAttribute(characterId, "size", -3);
            } else if (workingSection.toLowerCase().includes("tiny")) {
                setAttribute(characterId, "npc-size", 2);
                setAttribute(characterId, "size", -2);
            } else if (workingSection.toLowerCase().includes("small")) {
                setAttribute(characterId, "npc-size", 1);
                setAttribute(characterId, "size", -1);
            } else if (workingSection.toLowerCase().includes("large")) {
                setAttribute(characterId, "npc-size", -1);
                setAttribute(characterId, "size", 1);
            } else if (workingSection.toLowerCase().includes("huge")) {
                setAttribute(characterId, "npc-size", -2);
                setAttribute(characterId, "size", 2);
            } else if (workingSection.toLowerCase().includes("gargantuan")) {
                setAttribute(characterId, "npc-size", -4);
                setAttribute(characterId, "size", 3);
            } else if (workingSection.toLowerCase().includes("colossal")) {
                setAttribute(characterId, "npc-size", -8);
                setAttribute(characterId, "size", 4);
            } else {
                setAttribute(characterId, "npc-size", 0);
                setAttribute(characterId, "size", 0);
            }
            workingSection = populateStat(characterId, workingSection, /(?<=XP\s)\d+(\,\d\d\d)*?(?=\s*\w)/, "npc-xp", "xp");
            workingSection = populateStat(characterId, workingSection, /(?<=(Medium|Fine|Diminutive|Tiny|Small|Large|Huge|Gargantuan|Colossal)\s).*?(?=\s(~|Init))/, "npc-subtype", "type_subtype");
            let init = getFirstMatchingElement(workingSection, /(?<=Init\s(\+)*)\d+?(?=(;\s*))/);
            workingSection = populateStat(characterId, workingSection, /(?<=Senses\s(\+)*)\d+?(?=(;\s*(Perception)))/, "npc-senses", "sense");
            let perception = getFirstMatchingElement(workingSection, /(?<=Perception\s(\+)*)\d+?(?=(\s*($|Aura)))/);
            populateStat(characterId, workingSection, /(?<=Aura\s(\+)*)\d+?(?=(\s*$))/, "npc-senses", "sense")
            //</editor-fold>

            //<editor-fold desc="Character Sheet Defense">
            workingSection = getFirstMatchingElement(statBlock, /(?<=DEFENSE).*?(?=OFFENSE)/);

            populateStat(characterId, workingSection, /(?<=RP\s*)\d+/, "RP-npc", "rp");
            populateStat(characterId, workingSection, /(?<=SR\s*)\d+/, "npc-SR", "sr");
            populateStat(characterId, workingSection, /(?<=DR\s*).*?(?=(;|$))/, "npc-DR", "dr");

            workingSection = populateStat(characterId, workingSection, /(?<=HP\s*(\+\s)*)\d+/, "HP-npc", "hp");
            workingSection = populateStat(characterId, workingSection, /(?<=EAC\s*(\+\s)*)\d+/, "EAC-npc", "eac", "eac_base");
            workingSection = populateStat(characterId, workingSection, /(?<=KAC\s*(\+\s)*)\d+/, "KAC-npc", "kac", "kac_base");
            workingSection = populateStat(characterId, workingSection, /(?<=Fort\s*(\+\s)*)\d+/, "Fort-npc", "fort", "fort_base");
            workingSection = populateStat(characterId, workingSection, /(?<=Ref\s*(\+\s)*)\d+/, "Ref-npc", "ref", "ref_base");
            workingSection = populateStat(characterId, workingSection, /(?<=Will\s*(\+\s)*)\d+/, "Will-npc", "will", "will_base");
            workingSection = populateStat(characterId, workingSection, /(?<=Defensive Abilities\s*).*?(?=($|;|Resistances|Weaknesses|Immunities))/, "npc-defensive-abilities", "defensive-abilities");
            workingSection = populateStat(characterId, workingSection, /(?<=Immunities\s*).*?(?=($|;|Resistances|Weaknesses))/, "npc-immunities", "immunities");
            workingSection = populateStat(characterId, workingSection, /(?<=Resistances\s*).*?(?=($|;|Weaknesses))/, "npc-resistances", "resistances");
            populateStat(characterId, workingSection, /(?<=Weaknesses\s*).*?(?=($|;))/, "npc-weaknesses", "weaknesses");
            //</editor-fold>

            //<editor-fold desc="Character Sheet Offense">
            workingSection = getFirstMatchingElement(statBlock, /(?<=OFFENSE).*?(?=(TACTICS|STATISTICS))/);

            let speedInfo = getFirstMatchingElement(workingSection, /(?<=Speed\s).*?(?=(Space|Melee|Ranged|Multi))/);
            speedInfo = getFirstMatchingElement(speedInfo, /.*ft\./);
            setAttribute(characterId, "speed", speedInfo);
            setAttribute(characterId, "speed-base-npc", getFirstMatchingElement(speedInfo, /^\d+/));
            setAttribute(characterId, "speed-fly-npc", getFirstMatchingElement(speedInfo, /(?<=fly\s)\d+/));
            setAttribute(characterId, "speed-burrow-npc", getFirstMatchingElement(speedInfo, /(?<=burrow\s)\d+/));
            setAttribute(characterId, "speed-climb-npc", getFirstMatchingElement(speedInfo, /(?<=climb\s)\d+/));
            setAttribute(characterId, "speed-swim-npc", getFirstMatchingElement(speedInfo, /(?<=swim\s)\d+/));
            if (speedInfo.toLowerCase().includes("fly")) {
                if (speedInfo.includes("(Ex")) {
                    setAttribute(characterId, "speed-fly-source-npc", 1);
                } else if (speedInfo.includes("(Su")) {
                    setAttribute(characterId, "speed-fly-source-npc", 2);
                } else {
                    setAttribute(characterId, "speed-fly-source-npc", 3);
                }

                if (speedInfo.toLowerCase().includes("clumsy)")) {
                    setAttribute(characterId, "speed-fly-maneuverability-npc", -8);
                } else if (speedInfo.toLowerCase().includes("perfect)")) {
                    setAttribute(characterId, "speed-fly-maneuverability-npc", 8);
                } else {
                    setAttribute(characterId, "speed-fly-maneuverability-npc", 0);
                }
            }

            let offensiveAbilities = getFirstMatchingElement(workingSection, /(?<=Offensive\sAbilities).*?(?=(Spell|$))/);
            setAttribute(characterId, "npc-special-attacks", offensiveAbilities);

            populateStat(characterId, workingSection, /(?<=Space\s).*?(?=;)/, "space");
            populateStat(characterId, workingSection, /(?<=Reach\s).*?(?=\.)/, "reach");

            // TODO - Roll20 offensiveAbilities to special abilities

//            doWeapons(characterId, workingSection);
            //           doMagic(characterId, workingSection);
            //</editor-fold>

            //<editor-fold desc="Character Sheet Tactics">
            workingSection = getFirstMatchingElement(statBlock, /(?<=TACTICS).*?(?=STATISTICS)/);
            workingSection = removeStartingDelimiters(workingSection);
            if (workingSection !== "") {
                debugLog("Tactics = " + workingSection);
                setAttribute(characterId, "npc-tactics-show", 1);
                setAttribute(characterId, "tactics", workingSection);
                workingSection = getFirstMatchingElement(statBlock, /(?<=Before\sCombat).*?(?=(During\sCombat)|Morale|$)/)
                setAttribute(characterId, "npc-before-combat", workingSection);
                workingSection = getFirstMatchingElement(statBlock, /(?<=During\sCombat).*?(?=Morale|$)/)
                setAttribute(characterId, "npc-during-combat", workingSection);
                workingSection = getFirstMatchingElement(statBlock, /(?<=During\sCombat).*?(?=Morale)/)
                setAttribute(characterId, "npc-morale", workingSection);
            } else {
                setAttribute(characterId, "npc-tactics-show", 0);
            }
            //</editor-fold>

            //<editor-fold desc="Character Sheet Statistics">
            workingSection = getFirstMatchingElement(statBlock, /(?<=STATISTICS).*?(?=(SPECIAL ABILITIES|$))/);

            ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].forEach(roll20att => {
                let att = roll20att.substring(0, 3).toUpperCase();
                let re = new RegExp(`(?<=${att}\\s+\\+*)\\d+?(?=(\\s|;))`)
                let x = getFirstMatchingElement(workingSection, re);
                debugLog(att + " looks like " + x);
                let stat = parseFloat(x);
                debugLog(att + " now looks like " + stat);
                setAttribute(characterId, att + "-bonus", stat);
                setAttribute(characterId, att + "-temp", stat * 2);
                setAttribute(characterId, roll20att + "_base", stat);
                setAttribute(characterId, roll20att + "_mod", stat);
                if (att === "WIS") {
                    ["perception", "perception_base"].forEach(x => setAttribute(characterId, x, perception));
                    let adjustedPerception = parseFloat(perception) - stat;
                    ["Perception-npc-misc", "Perception-npc-ranks"].forEach(x => setAttribute(characterId, x, adjustedPerception));
                } else if (att === "DEX") {
                    ["initiative", "initiative_base"].forEach(x => setAttribute(characterId, x, init));
                    let adjustedInit = parseFloat(init) - stat;
                    ["npc-init-misc", "npc-init-ranks"].forEach(x => setAttribute(characterId, x, adjustedInit));
                }
            });

            populateStat(characterId, workingSection, /(?<=Languages*\s).*?(?=(ECOLOGY|$|;|Gear))/, "languages-npc", "languages");
            populateStat(characterId, workingSection, /(?<=Gear\s).*?(?=(ECOLOGY|$|;))/, "gear", "npc-gear")

            populateStat(characterId, workingSection, /(?<=Other Abilities\s).*?(?=((ECOLOGY)|(SPECIAL ABILITIES)|$))/, "SQ", "other_abilities");
            workingSection = populateStat(characterId, workingSection, /(?<=Environment).*(?=[\s\S]Organization)/gm, "environment");
            populateStat(characterId, workingSection, /(?<=Organization).*/gm, "organization");

            let featText = getFirstMatchingElement(statBlock, /(?<=Feats\s).*?(?=Skills)/);
            let match = featText.split(",");
            for (const m of match) {
                setAttribute(characterId, "npc-feats-show", 1);
                let uuid = generateRowID();
                setAttribute(characterId, "repeating_npc-feat_" + uuid + "_npc-feat-name", m.trim());
            }

            for (let skill of SkillList) {
                if (workingSection.includes(skill.name)) {
                    try {
                        let regexSkill =
                            new RegExp("(?<=" + skill.name + "\\s*)\\S+?(?=(\\,|\\s))", "i");
                        let bonus = getFirstMatchingElement(workingSection, regexSkill);
                        bonus = bonus.replaceAll("+", "")
                        let regexAtt = new RegExp(`(?<=${skill.attribute.toUpperCase()}\\s*)\\S+?(?=;|Skills)`, "i");
                        let attribute = getFirstMatchingElement(workingSection, regexAtt);
                        attribute = attribute.replaceAll("+", "")

                        let ranks = parseFloat(bonus) - parseFloat(attribute);
                        debugLog("Ranks: " + ranks + " = " + parseFloat(attribute) + " - " + parseFloat(bonus));
                        setAttribute(characterId, `${skill.name}-npc-misc`, ranks);
                        setAttribute(characterId, `${skill.name}-ranks`, ranks);
                        let skillName = skill.name.split('-').join('_').toLowerCase();
                        setAttribute(characterId, skillName, bonus);
                        setAttribute(characterId, skillName + "_base", bonus);
                    } catch (err) {
                        log(err.message);
                        log(err.stack);
                    }
                }
            }

            //</editor-fold>

            //<editor-fold desc="Character Sheet Special Abilities">
            workingSection = removeStartingDelimiters(getFirstMatchingElement(statBlock, /(?<=SPECIAL ABILITIES).*?/));
            if (workingSection !== "") {
                addSpecialAbilities(characterId, workingSection);
            } else {
                setAttribute(characterId, "npc-special-abilities-show", 0);
            }
            //</editor-fold>

        } catch (err) {
            speakAsGuidanceToGM("I have encountered an error importing this character. The error was around this area -> " + massageTheDataForAbilityParsing(statBlock.substr(0, 20)));
            log(err.message);
            log(err.stack);
        }


        setUpToken(selectedNPC.characterId, selectedNPC.npcToken);
        if (statBlock.toLowerCase().includes("trick attack")) {
            createObj("ability", {
                name: "Trick Attack (settings on main sheet)",
                description: "",
                action: "&{template:default}{{name=Trick Attack}}{{check=**CR**[[@{trick-attack-skill} - 20]]or lower }} {{foo=If you succeed at the check, you deal @{trick-attack-level} additional damage?{Which condition to apply? | none, | flat-footed, and the target is flat-footed | off-target, and the target is off-target | bleed, and the target is bleeding ?{How much bleed? &amp;#124; 1 &amp;#125; | hampered, and the target is hampered (half speed and no guarded step) | interfering, and the target is unable to take reactions | staggered, and the target is staggered (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | stun, and the target is stunned (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates) | knockout, and the target is unconscious for 1 minute (Fort **DC**[[10+[[(floor(@{level}/2))]]+[[@{DEX-mod}]]]]negates)} }} {{notes=@{trick-attack-notes}}}",
                _characterid: selectedNPC.characterId,
            });
            speakAsGuidanceToGM("Trick attack added to selected character");
        }

        speakAsGuidanceToGM(selectedNPC.characterSheet.get("name") + " NPC character sheet processed");
    };

    const frameLookup = {
        "racer": 1,
        "interceptor": 2,
        "fighter": 3,
        "shuttle": 4,
        "light freighter": 5,
        "explorer": 6,
        "transport": 7,
        "destroyer": 8,
        "heavy freighter": 9,
        "bulk freighter": 10,
        "cruiser": 11,
        "carrier": 13,
        "battleship": 14
    };

    function getShipFrame(basics) {
        basics = basics.toLowerCase();
        return frameLookup[basics] || 15;
    }

    let getShipBasics = function (text) {
        let start = 0;
        if (text.includes("Tiny")) {
            start = text.indexOf("Tiny");
        } else if (text.includes("Small")) {
            start = text.indexOf("Small");
        } else if (text.includes("Medium")) {
            start = text.indexOf("Medium");
        } else if (text.includes("Large")) {
            start = text.indexOf("Large");
        } else if (text.includes("Huge")) {
            start = text.indexOf("Huge");
        } else if (text.includes("Gargantuan")) {
            start = text.indexOf("Gargantuan");
        } else if (text.includes("Colossal")) {
            start = text.indexOf("Colossal");
        }
        return {name: text.substring(0, start), type: text.substring(start, text.indexOf("Speed"))};
    };

    let shipTemplateRowConvert = function (templateRow) {
        templateRow.val = templateRow.val.replace("—", "");
        if (templateRow.attribute.startsWith("AC") || templateRow.attribute.startsWith("TL")) {
            templateRow.val = parseFloat(templateRow.val) - 10;
        } else if (templateRow.attribute.startsWith("Maneuverability")) {
            debugLog("Setting Maneuver");
            if (templateRow.val.includes("poor")) {
                templateRow.val = String(-2);
            } else if (templateRow.val.includes("clumsy")) {
                templateRow.val = String(-1);
            } else if (templateRow.val.includes("average")) {
                templateRow.val = String(0);
            } else if (templateRow.val.includes("good")) {
                templateRow.val = String(1);
            } else {
                templateRow.val = String(2);
            }
            debugLog("Maneuvered");
        } else if (templateRow.attribute.includes("shield")) {
            templateRow.val = templateRow.val.replace(/\D/g, "");
        }
        return templateRow;
    };

    let abbreviateArc = function (arc) {
        if (arc.includes("orward")) {
            return "fwd";
        } else if (arc.includes("arboard")) {
            return "stbd";
        } else {
            return arc.match(/\((.*?)\)/)[1].toLowerCase();
        }
    };

    //Get or replace ability with specified ID
    let createAbility = function (name, pattern, id) {
        let checkAbility = findObjs({_type: 'ability', _characterid: id, name: name});
        if (checkAbility[0]) {
            checkAbility[0].set({action: pattern});
        } else {
            createObj('ability', {name: name, action: pattern, characterid: id, istokenaction: true});
        }
    }

    let formatTemplateAsMacro = function (spellAsMacro, template) {
        let filteredTemplate = template.filter(element => element.attribute !== undefined && element.val !== undefined);
        for (let i = 0; i < filteredTemplate.length; i++) {
            spellAsMacro += "{{" + filteredTemplate[i].sheetAttribute + "=" + filteredTemplate[i].val + "}}";
        }
        return spellAsMacro;
    };

    let formatSpellAsMacro = function (template) {
        let spellAsMacro = "?{Hide this roll?|No, |Yes,/w GM} &{template:default}";
        return formatTemplateAsMacro(spellAsMacro, template);
    };

    //</editor-fold>

    function identifyCharacterSheet(character) {
        if (simpleSheetUsed) {
            let sheet = getAttribute(character.characterId, "character_sheet");
            if (sheet != null) {
                if (sheet.get("current").startsWith("Starfinder v")) {
                    simpleSheetUsed = false;
                    speakAsGuidanceToGM("You are using the official Roll20 Starfinder sheet");
                    try {
                        let handoutName = "Welcome To Guidance";
                        let objs = findObjs({name: handoutName, _type: "handout"});
                        objs[0].set("gmnotes", "official");
                    } catch (err) {
                        log(err.message);
                        log(err.stack);
                    }
                }
            }
        }
    }

    //<editor-fold desc="Updated Population Helpers">
    let setUpToken = function (characterId, npcToken) {
        setToken(characterId, npcToken);
        try {
            //Create token macros for NPC saves and initiative rolls
            createAbility("0-Init", "%{selected|NPC-Initiative-Roll}", characterId);
            createAbility("1-Saves", "&{template:default}{{name=@{Selected|character_name} Saves}}{{check=Fort: [[1d20+@{Fort-npc}]]\nRef: [[1d20+@{Ref-npc}]]\nWill: [[1d20+@{Will-npc}]] }}", characterId);

            speakAsGuidanceToGM("Macros added to token");
        } catch (err) {
            debugLog("Token failure");
            log(err.message);
            log(err.stack);
            speakAsGuidanceToGM("636 Check to make sure the token is linked and the character sheet is populated");
        }
    };

    //</editor-fold>

    let doMagic = function (characterId, textToParse) {
        let guidanceMsg = "";
        textToParse = textToParse.substring(textToParse.indexOf("Spell"));
        textToParse = textToParse.replace(/\s+/, " ");
        let attackBonus = "";

        if (textToParse.includes("Spell-Like Abilities")) {
            let spellLikeAbilities = textToParse;
            if (spellLikeAbilities.includes("Spells Known")) {
                spellLikeAbilities = spellLikeAbilities.substring(0, spellLikeAbilities.indexOf("Spells Known"));
            }

            spellLikeAbilities = spellLikeAbilities.substring(spellLikeAbilities.indexOf("Spell-Like Abilities")).trim();
            let casterLevel = parseFloat(getFirstMatchingElement(spellLikeAbilities, /(?<=CL\s).*?(?=;)/));
            spellLikeAbilities = spellLikeAbilities.replace(/Spell-Like Abilities/, "").trim();

            debugLog("Spell like ability = " + spellLikeAbilities);
            let lines = spellLikeAbilities.match(/\d\/\w+|At will|Constant/g);

            setAttribute(characterId, "spellclass-0-level", casterLevel);
            for (let i = 0; i < lines.length; i++) {
                let ability = "";
                if (isEmpty(lines[i + 1])) {
                    ability = spellLikeAbilities.substring(spellLikeAbilities.indexOf(lines[i]));
                    debugLog("ability match a");
                } else {
                    ability = spellLikeAbilities.substring(spellLikeAbilities.indexOf(lines[i]), spellLikeAbilities.indexOf(lines[i + 1]));
                    debugLog("ability match b");
                    debugLog("Text to parse 1 " + lines[i] + " " + spellLikeAbilities.indexOf(lines[i]));
                    debugLog("Text to parse 2 " + lines[i + 1] + " " + spellLikeAbilities.indexOf(lines[i + 1]));
                }
                addSpellLikeAbility(characterId, ability);
            }
        } else {
            setAttribute(characterId, "npc-spell-like-abilities-show", 0);
        }

        if (textToParse.includes("Spells Known")) {
            textToParse = textToParse.substring(textToParse.indexOf("Spells Known")).trim();
            if (textToParse.includes("Spell-Like Abilities")) {
                guidanceMsg += "Warning! Spell-like Abilities appears twice! I can't handle a 2nd entry of Spell like abilities! What the heck Paizo???<br>";
                guidanceMsg += "*grumble* I bet this is an Emotivore Mastermind *grumble*<br><br>Anyway, ";
                textToParse = textToParse.substring(0, textToParse.indexOf("Spell-Like Abilities"));
            }
            guidanceMsg += "This character has spells. Check Out the command sf_addspell to assist in adding Spell Macros <br>";
            setAttribute(characterId, "spellclass-1-level", getFirstMatchingElement(textToParse, /(?<=CL\s).*?(?=;)/).replace(/\D/g, ""));

            attackBonus = textToParse.replace(/\(.*;/, "");
            attackBonus = attackBonus.replace("Spells Known", "");
            attackBonus = attackBonus.substring(0, attackBonus.indexOf(")"));
            textToParse = textToParse.substring(textToParse.indexOf(")") + 1);

            let level = "";
            if (hasLevels(textToParse)) {
                level = spellSubString(textToParse, "6th", "5th");
                if (level !== undefined) {
                    addSpellWithLevel(characterId, level, attackBonus);
                }
                level = spellSubString(textToParse, "5th", "4th");
                if (level !== undefined) {
                    addSpellWithLevel(characterId, level, attackBonus);
                }
                level = spellSubString(textToParse, "4th", "3rd");
                if (level !== undefined) {
                    addSpellWithLevel(characterId, level, attackBonus);
                }
                level = spellSubString(textToParse, "3rd", "2nd");
                if (level !== undefined) {
                    addSpellWithLevel(characterId, level, attackBonus);
                }
                level = spellSubString(textToParse, "2nd", "1st");
                if (level !== undefined) {
                    addSpellWithLevel(characterId, level, attackBonus);
                }
                level = spellSubString(textToParse, "1st", "0 (at will)");
                if (level !== undefined) {
                    addSpellWithLevel(characterId, level, attackBonus);
                }
                level = spellSubString(textToParse, "0 (at will)", "Constant");
                if (level !== undefined) {
                    addSpellWithLevel(characterId, level, attackBonus);
                }
            } else {
                let lines = textToParse.match(/\d\/\w+|At will|Constant/g);

                for (let i = 0; i < lines.length; i++) {
                    let spell = "";
                    if (isEmpty(lines[i + 1])) {
                        spell = textToParse.substring(textToParse.indexOf(lines[i]));
                        debugLog("spell match a");
                    } else {
                        spell = textToParse.substring(textToParse.indexOf(lines[i]), textToParse.indexOf(lines[i + 1]));
                        debugLog("spell match b");
                        debugLog("Text to parse 1 " + lines[i] + " " + textToParse.indexOf(lines[i]));
                        debugLog("Text to parse 2 " + lines[i + 1] + " " + textToParse.indexOf(lines[i + 1]));

                    }
                    addSpellWithoutLevel(characterId, spell);
                }
            }
        } else {
            setAttribute(characterId, "npc-spells-show", 0);
        }
        if (!guidanceMsg) {
            speakAsGuidanceToGM(guidanceMsg);
        }
    };

    //<editor-fold desc="Old Population Helpers">
    let setToken = function (characterId, npcToken) {
        let hitPoints;
        let eac;
        let kac;

        try {
            if (simpleSheetUsed) {
                hitPoints = getAttribute(characterId, "HP-npc");
                eac = getAttribute(characterId, "EAC-npc");
                kac = getAttribute(characterId, "KAC-npc");
            } else {
                hitPoints = getAttribute(characterId, "hp");
                eac = getAttribute(characterId, "eac");
                kac = getAttribute(characterId, "kac");
            }

            npcToken.set("bar1_link", hitPoints.id);
            npcToken.set("bar2_value", "EAC " + eac.get("current"));
            npcToken.set("bar2_max", eac.get("current"));
            npcToken.set("bar3_value", "KAC " + kac.get("current"));
            npcToken.set("bar3_max", kac.get("current"));
            npcToken.set("showname", true);
        } catch (err) {
            log(err.message);
            log(err.stack);
            speakAsGuidanceToGM("Check to make sure the token is linked and the character sheet is populated - 1211");
        }
    };

    let populateStarshipData = function (gmNotes, c) {
        let cleanNotes = cleanText(gmNotes).trim();
        debugLog("clean notes = " + cleanNotes);


        if (debugMode) {
            c.npcToken.set("gmnotes", cleanNotes);
        }
        const attributes = {};

        let ship = parseStatBlock(getShipStatBlocks(), cleanNotes);
        setAttribute(c.characterId, "tab", 3);
        setToken(c.characterSheet, c.npcToken);

        let basics = getShipBasics(cleanNotes);
        debugLog("Basics = " + basics);
        let frame = getShipFrame(basics.type.toLowerCase());

        setAttribute(c.characterId, "starship-name", c.characterSheet.get("name"));
        setAttribute(c.characterId, "starship-make", basics.type);
        setAttribute(c.characterId, "starship-pc-crew-show", 0);
        debugLog("Frame = " + frame);
        setAttribute(c.characterId, "starship-frame", String(frame));
        setAttribute(c.characterId, "starship-weapon-fwd-weapon1-show", 0);
        setAttribute(c.characterId, "starship-weapon-port-weapon1-show", 0);
        setAttribute(c.characterId, "starship-weapon-aft-weapon1-show", 0);
        setAttribute(c.characterId, "starship-weapon-turret-weapon1-show", 0);
        setAttribute(c.characterId, "starship-weapon-stbd-weapon1-show", 0);

        // get piloting stat and make macro
        let piloting = cleanNotes.match(/iloting\s*(?:\+\s*(\d+))?/);
        let pilotBonus = piloting?.[1] ?? "?{Piloting Bonus?|0}";
        let pilotingRanks = piloting ? piloting[0].match(/\((.*?)\)/)?.[1] : "Ranks Not Defined";

        let pilotingMacro = `&{template:default} {{name=${c.characterSheet.get("name")}'s Piloting}} {{skill_chk=[[[[d20+${pilotBonus}]] + ?{Any other modifiers?|0}]]}}{{notes=${pilotingRanks}}}`;

        createObj("ability", {
            name: "Piloting Check",
            description: "",
            action: pilotingMacro,
            _characterid: c.characterId,
        });

        let gunnery = cleanNotes.match(/unnery\s*(.*?)(?:\s|$)/)?.[1];

        let filtered = ship.filter(element => element.val !== undefined && element.sheetAttribute !== undefined && !element.sheetAttribute.includes("weapon"));
        filtered.forEach(function (i) {
            i.val = i.val.replace(i.attribute, "").trim();
            let attrib = shipTemplateRowConvert(i);
            attributes[attrib.sheetAttribute] = attrib.val;
        });

        setAttribute(c.characterId, "starship-frame", String(frame));
        setAttribute(c.characterId, "starship-name", c.characterSheet.get("name"));
        let allAttacks = cleanNotes.substring(cleanNotes.indexOf("Attack"), cleanNotes.indexOf("Power Core"));
        let allArcs = allAttacks.split("Attack ");

        allArcs.forEach(function (arc) {
            debugLog("Arc = " + arc);
            let weapons = arc.substring(arc.indexOf(")") + 1).trim();
            debugLog(weapons);
            let weapon = weapons.split(", ");
            let direction = arc.substring(1, arc.indexOf(")"));
            debugLog(direction);
            let i = 1;
            weapon.forEach(function (w) {
                debugLog("w = " + w);
                debugLog("Gunnery = " + gunnery);
                let weaponName = w.substring(0, w.indexOf("("));
                debugLog("WeaponName = " + weaponName);
                if (weaponName.trim() === "") {
                    return;
                }
                let bonus = gunnery.substring(gunnery.indexOf("+") + 1, gunnery.indexOf("(")).trim();
                if (bonus === undefined || String(bonus).trim() === "" || isNaN(bonus)) {
                    bonus = "?{Gunner's Attack Bonus|0}";
                }

                debugLog("Bonus = " + bonus);
                debugLog("w (before getting damage) = " + w);
                let damage = w.substring(w.indexOf("(") + 1);
                if (damage.includes(")")) {
                    damage = damage.substring(0, damage.indexOf(")"));
                }
                debugLog("damage = " + damage);
                let range = "";
                if (damage.includes(";")) {
                    damage = damage.substring(0, damage.indexOf(";")).trim();
                    range = damage.substring(damage.indexOf(";") + 1).trim();
                } else if (damage.includes(",")) {
                    damage = damage.substring(0, damage.indexOf(",")).trim();
                    range = damage.substring(damage.indexOf(",") + 1).trim();
                }
                debugLog("Damage = " + damage);
                debugLog("Range = " + range);

                let weaponMacro = "&{template:default} {{name=" + c.characterSheet.get("name") +
                    "'s " + weaponName + "}} {{attack=[[ [[d20+" + bonus + "]] + ?{Any other modifiers?|0}]] }}" +
                    " {{damage=[[" + damage + "]] }} {{notes=" + range + " }} }} ";

                createObj("ability", {
                    name: direction.trim() + " " + weaponName.trim() + " fire",
                    description: "",
                    action: weaponMacro,
                    _characterid: c.characterId,
                });

                let abb = abbreviateArc(arc);
                setAttribute(c.characterId, "starship-" + abb + "-weapon" + i, weaponName);
                setAttribute(c.characterId, "starship-" + abb + "-weapon" + i + "-special", "See Abilites for Macro");
                setAttribute(c.characterId, "starship-" + abb + "-weapon" + i + "-dmg", damage);
                setAttribute(c.characterId, "starship-" + abb + "-weapon" + i + "-rng", range);
                setAttribute(c.characterId, "starship-weapon-" + abb + "-weapon1-show", 1);
                i++;
            });
        });

        let hitPoints = getAttribute(c.characterId, "starship-hp");
        c.npcToken.set("bar1_link", hitPoints.id);
        let armorClass = getAttribute(c.characterId, "starship-ac-misc").get("current");
        armorClass = parseFloat(armorClass) + 10;
        c.npcToken.set("bar2_value", "AC " + armorClass);
        c.npcToken.set("bar2_max", armorClass);
        armorClass = getAttribute(c.characterId, "starship-tl-misc").get("current");
        armorClass = parseFloat(armorClass) + 10;
        c.npcToken.set("bar3_value", "TL " + armorClass);
        c.npcToken.set("bar3_max", armorClass);
        c.npcToken.set("showname", true);
        speakAsGuidanceToGM("Token setup. For extra settings, check out the API TokenMod");

        speakAsGuidanceToGM(c.characterSheet.get("name") + " a " + basics.type + " has been constructed");
    };

    let spellSubString = function (text, start, end) {
        if (text.includes(start)) {
            if (text.includes(end)) {
                return text.substring(text.indexOf(start), text.indexOf(end)).trim();
            } else {
                return text.substring(text.indexOf(start)).trim();
            }
        }
        return undefined;
    };

    let hasLevels = function (t) {
        if (t.includes("1st") || t.includes("0 (at") || t.includes("2nd") || t.includes("3rd") || t.includes("4th") || t.includes("5th") || t.includes("6th")) {
            if (!t.includes("Level") && !t.includes("level")) {
                return true;
            }
        }
        return false;
    };

    let addSpellWithLevel = function (characterId, textToParse, additional) {
        textToParse = textToParse.replace(/—/g, "");
        let uuid = generateRowID();
        let value = textToParse.substring(0, textToParse.indexOf("(")).replace(/\D/g, "").trim();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-level", value);
        value = textToParse.substring(textToParse.indexOf("("), textToParse.indexOf(")") + 1).trim();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-usage", value);
        value = "(" + additional.trim() + ") " + textToParse.substring(textToParse.indexOf(")") + 1).trim();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-list", value);
    };

    let addSpellWithoutLevel = function (characterId, textToParse) {
        let uuid = generateRowID();
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-usage", textToParse.substring(0, textToParse.indexOf("—")).trim());
        setAttribute(characterId, "repeating_spells_" + uuid + "_npc-spell-list", textToParse.substring(textToParse.indexOf("—") + 2).trim());
    };

    let addSpellLikeAbility = function (characterId, textToParse) {
        let uuid = generateRowID();
        setAttribute(characterId, "repeating_npc-spell-like-abilities_" + uuid + "_npc-abil-usage", textToParse.substring(0, textToParse.indexOf("—")).trim());
        setAttribute(characterId, "repeating_npc-spell-like-abilities_" + uuid + "_npc-abil-name", textToParse.substring(textToParse.indexOf("—") + 2).trim());
    };

    let addSpecialAbilities = function (characterId, textToParse) {
        debugLog("Parsing Special Abilities");
        let uuid;

        setAttribute(characterId, "npc-special-abilities-show", 1);
        if (textToParse.includes("(")) {
            do {
                uuid = generateRowID();
                let abilityName = getFirstMatchingElement(textToParse, /.*?\)/);
                setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-name", abilityName);
                textToParse = getFirstMatchingElement(textToParse, /(?<=\)).*/);
                let nextAbility = textToParse.match(/\.([^\.]*?)\(..\)/);
                if (nextAbility === undefined || nextAbility === null) {
                    setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.trim());
                    return;
                }
                let endPoint = textToParse.indexOf(nextAbility[0]) + 1;
                setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.substring(0, endPoint).trim());
                textToParse = textToParse.substring(endPoint);
            } while (textToParse.includes("("));
        } else {
            uuid = generateRowID();
            setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-name", "Special Abilities");
            textToParse = textToParse.replace(/\./, ".\n");
            setAttribute(characterId, "repeating_special-ability_" + uuid + "_npc-spec-abil-description", textToParse.trim());
        }
        speakAsGuidanceToGM("Added " + abilityName + " to Character");
    };

    let doWeapons = function (characterId, textToParse) {
        let delimiter = "~~~";
        textToParse = textToParse.replace(/Attacks/i, ""
        ).replace(/ or /g, delimiter
        ).replace(/Ranged/g, delimiter
        ).replace(/Melee/g, delimiter
        ).replace(/OFFENSE/, ""
        ).replace(/Multiattack/, delimiter + "Multiattack"
        );

        if (textToParse.includes("Space")) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Space"));
        }

        if (textToParse.includes("Spell")) {
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

        if (textToParse.includes("Offensive Abilities")) {
            textToParse = textToParse.substring(0, textToParse.indexOf("Offensive Abilities"));
        }

        let attacks = textToParse.split(delimiter);
        for (let attack of attacks) {
            attack = attack.trim();
            debugLog("Examining Attack " + attack);
            if (attack.length > 1) {
                if (!(attack.startsWith("Space") || attack.startsWith("Reach") || attack.startsWith("ft"))) {
                    debugLog("Adding Attack " + attack);
                    try {
                        armNPC(characterId, attack);
                    } catch (err) {
                        log(err.message);
                        log(err.stack);
                        speakAsGuidanceToGM("Could not populate data for weapon " + attack);
                    }
                }
            }

        }
    };

    let armNPC = function (characterId, attackToParse) {
        debugLog("Parsing " + attackToParse);
        let uuid = generateRowID();

        let details = attackToParse.split(" ");
        let i = 0;
        let weapon = "";
        while (isNaN(details[i]) && i < details.length) {
            weapon = weapon + details[i] + " ";
            i++;
        }

        if (i === details.length) {
            debugLog("Problem parsing Weapons");
            return;
        }
        let attackBonus = details[i];

        if (simpleSheetUsed) {
            setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-notes", attackToParse);
            setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-name", weapon);
            setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-attack", attackBonus);
        } else {
            setAttribute(characterId, "repeating_attack_" + uuid + "_description", attackToParse);
            setAttribute(characterId, "repeating_attack_" + uuid + "_name", weapon);
            setAttribute(characterId, "repeating_attack_" + uuid + "_base_attack_bonus_base", attackBonus);
            setAttribute(characterId, "repeating_attack_" + uuid + "_base_attack_bonus", 0);
        }
        i++;

        let damage = details[i].replace(/\(/, "");
        let numDice = damage.split("d");
        let dnd = numDice[1].split("+");

        if (simpleSheetUsed) {
            setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-damage-dice-num", numDice[0]);
            setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-damage-die", dnd[0]);
            if (dnd[1] !== undefined) {
                setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-damage", dnd[1]);
            }
        } else {
            setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_damage_dice", damage);
        }

        i++;
        //createWeaponDamageType(characterId, uuid, details, i);
        try {
            if (i <= details.length) {
                debugLog("Weapon type: " + details[i]);
                let damageType = details[i];
                //Test for 2 damage types aka plasma E & F
                if (details[i + 1] == "&") {
                    damageType += details[++i] + " " + details[++i];
                }
                damageType = details[i].replace(/;/, "").replace(/\)/, "");
                setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-type", damageType);
            }
        } catch (err) {
            debugLog("Error parsing damage type for: " + uuid);
            log(err.message);
            log(err.stack);
        }
        i++;
        //createWeaponCriticals(characterId, uuid, details, i);
        try {
            if (i <= details.length && details[i] !== ")") {
                if (details[i] === "critical") {
                    i++;
                    //Probably need a foreach in here to go through the rest
                    let critical = "";
                    while (i < details.length) {
                        critical = critical + " " + details[i];
                        i++;
                    }
                    critical = critical.replace(/\)/, "")
                    debugLog("Weapon Critical: " + critical);
                    setAttribute(characterId, "repeating_npc-weapon_" + uuid + "_npc-weapon-critical", critical);
                }
            }
        } catch (err) {
            debugLog("Error parsing damage critical for: " + uuid);
            log(err.message);
            log(err.stack);
        }

        //Add token macro for parsed weapon attack
        debugLog("Creating weapon ability " + uuid);
        try {
            createObj("ability", {
                name: "2-" + weapon,
                description: details,
                action: "%{selected|repeating_npc-weapon_" + uuid + "_roll}",
                _characterid: characterId,
                istokenaction: true
            });
        } catch (err) {
            debugLog("Creating weapon ability error occurred.");
            log(err.message);
            log(err.stack);
        }
        debugLog("Creating weapon ability " + uuid + " completed");
    };

    let parseStatBlock = function (statBlockTemplate, statBlockText) {
        debugLog(statBlockTemplate.length);
        let statBlockData = [];
        for (let i = 0; i < statBlockTemplate.length; i++) {
            if (statBlockTemplate[i].attribute !== undefined && statBlockTemplate[i].attribute !== "") {
                let preParsedText = statBlockText;
                if (i > 0 && statBlockTemplate[i - 1].attribute !== "") {
                    preParsedText = statBlockText.substring(statBlockText.indexOf(statBlockTemplate[i - 1].attribute));
                }
                let re = new RegExp(`(?<=${statBlockTemplate[i].attribute}\s)\w+?(?=(\s|;))`);
                let val = getFirstMatchingElement(preParsedText, re);
                statBlockData.push(new TemplateRow(i, statBlockTemplate[i].attribute, val));
                debugLog(statBlockTemplate[i].attribute + " = " + val);
            }
        }
        return statBlockData;
    };
    //</editor-fold>

    //<editor-fold desc="Stat block formatter templates">
    let getShipStatBlocks = function () {
        let t = [];
        t.push(new TemplateRow(t.length, ""));
        t.push(new TemplateRow(t.length, ""));
        t.push(new TemplateRow(t.length, ""));
        t.push(new TemplateRow(t.length, ""));
        t.push(new TemplateRow(t.length, "Speed"));
        t.push(new TemplateRow(t.length, "Maneuverability"));
        t.push(new TemplateRow(t.length, "Drift"));
        t.push(new TemplateRow(t.length, "AC"));
        t.push(new TemplateRow(t.length, "TL"));
        t.push(new TemplateRow(t.length, "HP"));
        t.push(new TemplateRow(t.length, "DT"));
        t.push(new TemplateRow(t.length, "CT"));
        t.push(new TemplateRow(t.length, "Shields"));
        t.push(new TemplateRow(t.length, "(forward"));
        t.push(new TemplateRow(t.length, "port"));
        t.push(new TemplateRow(t.length, "starboard"));
        t.push(new TemplateRow(t.length, "aft"));
        t.push(new TemplateRow(t.length, "Attack (Forward)"));
        t.push(new TemplateRow(t.length, "Attack (Port)"));
        t.push(new TemplateRow(t.length, "Attack (Starboard)"));
        t.push(new TemplateRow(t.length, "Attack (Aft)"));
        t.push(new TemplateRow(t.length, "Attack (Turret)"));
        t.push(new TemplateRow(t.length, "Power Core"));
        t.push(new TemplateRow(t.length, "Drift Engine"));
        t.push(new TemplateRow(t.length, "Systems"));
        t.push(new TemplateRow(t.length, "Expansion Bays"));
        t.push(new TemplateRow(t.length, "Modifiers"));
        t.push(new TemplateRow(t.length, "Complement"));
        t.push(new TemplateRow(t.length, "CREW"));
        t.push(new TemplateRow(t.length, "Captain"));
        t.push(new TemplateRow(t.length, "Engineer"));
        t.push(new TemplateRow(t.length, "Gunner")); //(s) (#)
        t.push(new TemplateRow(t.length, "Pilot"));
        t.push(new TemplateRow(t.length, "Science Officer"));
        t.push(new TemplateRow(t.length, "SPECIAL ABILITIES"));
        t.sort(function (a, b) {
            return a.order - b.order;
        });
        return t;
    };

    let getSpellStatBlocks = function () {
        let spellArray = [];
        spellArray.push(new TemplateRow(spellArray.length, ""));
        spellArray.push(new TemplateRow(spellArray.length, "Source"));
        spellArray.push(new TemplateRow(spellArray.length, "Classes"));
        spellArray.push(new TemplateRow(spellArray.length, "School"));
        spellArray.push(new TemplateRow(spellArray.length, "Casting Time"));
        spellArray.push(new TemplateRow(spellArray.length, "Range"));
        spellArray.push(new TemplateRow(spellArray.length, "Area"));
        spellArray.push(new TemplateRow(spellArray.length, "Effect"));
        spellArray.push(new TemplateRow(spellArray.length, "Target"));
        spellArray.push(new TemplateRow(spellArray.length, "Duration"));
        spellArray.push(new TemplateRow(spellArray.length, "Saving Throw"));
        //spellArray.push(new TemplateRow(spellArray.length, "save_effect", "Save Effect"));
        spellArray.push(new TemplateRow(spellArray.length, "Spell Resistance"));
        spellArray.push(new TemplateRow(spellArray.length, "Ranged Attack"));
        spellArray.push(new TemplateRow(spellArray.length, "Melee Attack"));
        spellArray.push(new TemplateRow(spellArray.length, "Damage"));
        spellArray.push(new TemplateRow(spellArray.length, "Description"));
        spellArray.sort(function (a, b) {
            return a.order - b.order;
        });
        return spellArray;
    };

    //</editor-fold>
    class TemplateRow {
        constructor(sortOrder, attribute, value) {
            this.val = value;
            this.order = sortOrder;
            this.attribute = attribute;
        }
    }


}
());