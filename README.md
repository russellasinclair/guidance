# Guidance
API for Roll20 and Starfinder
Grab it and try it!

This is a tool to support the usage of the Starfinder (Simple) character sheets in Roll20. 

Guidance allows you to import stat blocks from Archive of Nethys and StarjammerSRD, into the NPC tab of the Starfinder (Simple) character sheet. Stat blocks from PDFs and the Roll20 Starfinder compendiums generally work, but due to odd formatting, you should double check the work. I recommend checking one of the approved sources for a statblock listed in a PDF or elsewhere.

Guidance provides 2 primary functions. Click on a token that has been linked to a character sheet.

!sf_populate - When a token has been linked to a character sheet, it will read the statblock from the *GM Notes* section of the *character sheet* and populate the appropriate values in the NPC tab of the Starfinder (Simple) character sheet. It also configures other details about the linked token: HP, EAC, KAC.  It will generate token macros for Initiative, Saves, and all parsed weapon attacks.
 
**usage**:  `!sf_populate`

!sf_clean - This command will erase an entire character sheet. Note that you must type "CONFIRM" to allow it to delete.  The parameter "ABILITIES" will clear out all abiltiies on the character sheet including token macros.

**usage**:  `!sf_clean CONFIRM`
**usage**:  `!sf_clean ABILITIES`


If you find any issues, feel free to reach out to me at russell@theresdev.com.

The wikipage can be found at - 

The source code can be found at - https://github.com/russellasinclair/guidance/
