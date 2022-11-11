import { google, docs_v1, Auth, Common } from "googleapis";
import * as mdHelper from "./mdHelper";

export function markdownToGoogleDocsReq(markdown: string): docs_v1.Schema$Request[]{	
	function isNewLineChar(index: number = pointer){
		if(markdown[index] === "\r" && markdown[index + 1] === "\n"){
			return 2;
		}
		if (markdown[index] === "\n" || markdown[index] === "\r") {
			return 1;
		}
		return 0;
	}

	function isEmptyLine(index: number = pointer){
		const length = charRepeatLenght("", true, index).indexDelta();
		const endCharacters = isNewLineChar(index + length);
		if(endCharacters === 0){
			return 0;
		}
		return length + endCharacters;
	}
	
	function charRepeatLenght(char: string, ignoreSpces: boolean = false, startIndex: number = pointer){
		const ret = { 
			char: 0, 
			spaces: 0, 
			tabs: 0, 
			totalSpace: () => ret.tabs * 4 + ret.spaces, 
			indexDelta: () => ret.char + ret.spaces + ret.tabs
		};
		while(true){
			const currentIndex = startIndex + ret.indexDelta();
			if (currentIndex === docsLength){
				return ret;
			}

			if(markdown[currentIndex] === char){
				ret.char++;
			} else if (ignoreSpces && markdown[currentIndex] === " "){
				ret.spaces++;
			} else if (ignoreSpces && markdown[currentIndex] === "\t"){
				ret.tabs++;
			} else {
				return ret;
			}
		}
	}

	function nextLine(startIndex: number = pointer){
		while(startIndex < docsLength){
			const lines = isNewLineChar(startIndex);
			if(lines !== 0){
				return startIndex + lines;
			}
			pointer++;
		}
		return -1;
	}

	function lineStart(index: number = pointer){
		while(0 < index){
			if(isNewLineChar(index - 1) === 1){
				return index;
			}
			index--;
		}
		return 0;
	}

//	function previusLinePoint(startIndex: number = pointer){
//		while(startIndex > 0){
//
//		}
//		return -1
//	}

	function getTextInLine(index: number = pointer){
		index = lineStart(index);
		var offset = 0;
		while(index + offset < docsLength){
			if(isNewLineChar(index + offset) !== 0){
				break;
			}
			offset++;
		}
		return markdown.slice(index, index + offset);
	}

	function nextEnterSeperator(startIndex: number = pointer){
		while(startIndex < docsLength){
			const lines = isNewLineChar(startIndex);
			if(lines !== 0 && startIndex + lines < docsLength){
				startIndex += lines;
				const repete = charRepeatLenght("", true, startIndex);
				if(startIndex + repete.spaces < docsLength){
					startIndex += repete.spaces;
				}
				
			}
			pointer++;
		}
		return startIndex--;
	}

	function charOwnLineInSection(repChar : string, minRepAmount : number = 3, startIndex: number = pointer){
		const lastIndex = nextEnterSeperator(startIndex);
		while (startIndex <= lastIndex){
			const spaces = charRepeatLenght("", true, startIndex);
			startIndex += spaces.indexDelta();
			if(spaces.totalSpace() <= 3){
				const charRepet = charRepeatLenght(repChar, false, startIndex);
				startIndex += charRepet.char;
				if(charRepet.char <= minRepAmount){
					const extraSpace = charRepeatLenght("", true, startIndex);
					startIndex += extraSpace.indexDelta();
					if(isNewLineChar(startIndex)){
						return {ret: true, amount: charRepet.char, nextLine: startIndex + isNewLineChar(startIndex)};
					}
				}
			}
		}
		return {ret: false, amount: 0, nextLine: lastIndex};
	}

	function getBlock(startIndex: number = pointer){
		const ret = {
			endindex: -1
		};
	}

	const mdBlock = {
		indentedCodeBlock: (startline: number) => {

		},

		indentedCodeBlockContinue: (startline: number) => {

		},
	};

	var req = new Array<docs_v1.Schema$Request>();
	const docsLength = markdown.length;
	let pointer = 0;
	let startLine = 0;
	let boldStart = -1;
	let italicStart = -1;
	let titleStart = -1;
	let titleType = 0;


	/*
	TODO: ✅🚧 

    Thematic breaks
    ATX headings
    Setext headings
    ✅Indented code blocks
    ✅Fenced code blocks
    🚫HTML blocks
    Link reference definitions
    Paragraphs

    Block quotes
    List items
    Lists
	
    Code spans
    Emphasis and strong emphasis
    Links
    Images
    Autolinks
    🚫Raw HTML
    Hard line breaks
    Soft line breaks
    Textual content

	*/
	while (true){
		const newLines = isEmptyLine();
		if(newLines === 0){
			break;
		}
		pointer += newLines;
	}

	while (pointer < docsLength){
		const spaces = charRepeatLenght("");

		if(startLine === docsLength){

			if(false){ // list

			}

			if(spaces.totalSpace() > 3 &&  true && true){ // FIXME: not a paragraf in fron and not a list
				let text = getTextInLine();
				text = mdHelper.IndentedCodeBlock.whitespaceRemove(text);

				let i = pointer;
				while(i < docsLength && true){ // somthin with i;
					i = nextLine(i);

					if( isEmptyLine(i) < 0){
						text += "/n";

						continue;
					}

					const spaces = charRepeatLenght("");
					if(spaces.totalSpace() > 3 && true) { // FIXME: not a list
						let newText = getTextInLine(i);
						text += "/n" + mdHelper.IndentedCodeBlock.whitespaceRemove(newText);

						continue;
					}
					break;
				}
				text.trimEnd();
				pointer = nextLine(i);
				// TODO: add text to document;
			}
			
			if(spaces.totalSpace() <= 3 ) {
				pointer += spaces.indexDelta();
				
				const fencedCodeblock = {
					char: "",
					amount: 0,
					spaces: 0
				};
				const repetedBacksticks = charRepeatLenght("`");
				if(3 <= repetedBacksticks.char){
					fencedCodeblock.char = "`";
					fencedCodeblock.amount = repetedBacksticks.char;
					fencedCodeblock.spaces = spaces.totalSpace();
				}
				const repetedTildes = charRepeatLenght("~");
				if(3 <= repetedTildes.char){
					fencedCodeblock.char = "~";
					fencedCodeblock.amount = repetedTildes.char;
					fencedCodeblock.spaces = spaces.totalSpace();
				}
				if(fencedCodeblock.char !== ""){
					let text = "";
					let i = pointer;
					while (i < docsLength){
						const spaces = charRepeatLenght("", true);
						if(spaces.totalSpace() <= 3){
							const repeatEndChar = charRepeatLenght(fencedCodeblock.char); 
							if(fencedCodeblock.amount <= repeatEndChar.char && isEmptyLine(i + spaces.indexDelta() + repeatEndChar.char) !== 0){
								break;
							}
						}

						let skipSpace = spaces.indexDelta() <= fencedCodeblock.spaces ? spaces.indexDelta() : fencedCodeblock.spaces;
						text += getTextInLine(i).slice(skipSpace) + "\n";
						i = nextLine(i);
					}

					text.trimEnd();
					pointer = nextLine(i);

					// TODO: add text to document
				}


				const equelTitle = charOwnLineInSection("=");
				if(equelTitle.ret){
					//h1 titel
				}
	
				const hyphenTitle = charOwnLineInSection("-");
				if(hyphenTitle.ret){
					//h2 titel§
				}
	
				const titleHashtags = charRepeatLenght("#");
				if(0 < titleHashtags.char && titleHashtags.char <= 6){
					const spaces = charRepeatLenght("", true);
					if (0 < spaces.indexDelta() || 0 < isNewLineChar(pointer+titleHashtags.char+spaces.spaces)){
						//det sak var titel
					}
				}
			}
		}
		
		var newLines = isNewLineChar();
		if(0 > newLines){
			//add new line
			pointer += newLines;
			startLine = pointer;
		}
	}

	req.push({
		insertText: {
			endOfSegmentLocation: {},
			text: markdown
		}
	});
	return req;
}