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
			chars: 0, 
			spaces: 0, 
			tabs: 0, 
			totalSpace: () => ret.tabs * 4 + ret.spaces, 
			indexDelta: () => ret.chars + ret.spaces + ret.tabs
		};
		while(true){
			const currentIndex = startIndex + ret.indexDelta();
			if (currentIndex === docsLength){
				return ret;
			}

			if(markdown[currentIndex] === char){
				ret.chars++;
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
				startIndex += charRepet.chars;
				if(charRepet.chars <= minRepAmount){
					const extraSpace = charRepeatLenght("", true, startIndex);
					startIndex += extraSpace.indexDelta();
					if(isNewLineChar(startIndex)){
						return {ret: true, amount: charRepet.chars, nextLine: startIndex + isNewLineChar(startIndex)};
					}
				}
			}
		}
		return {ret: false, amount: 0, nextLine: lastIndex};
	}

	function paragrafFlush(){
		if(paragrafText === ""){
			return;
		}
		// TODO: impliment paragraf to document
	}

	var req = new Array<docs_v1.Schema$Request>();
	const docsLength = markdown.length;
	let pointer = 0;
	let startLine = 0;
	let paragrafText = "";
	// let boldStart = -1;
	// let italicStart = -1;
	// let titleStart = -1;
	// let titleType = 0;


	/*
	TODO: ✅🚧 

    ✅Thematic breaks
    ✅ATX headings
    ✅Setext headings
    ✅Indented code blocks
    ✅Fenced code blocks
    🚫HTML blocks
    Link reference definitions
    ✅Paragraphs

    ✅Block quotes
    ✅List items
    ✅Lists
	
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

		if(startLine !== docsLength){

			// Setaxt headders
			if(paragrafText !== ""){
				const equelTitle = charOwnLineInSection("=");
				if(equelTitle.ret){
					// TODO: inpliment h1 titel
				}
	
				const hyphenTitle = charOwnLineInSection("-");
				if(hyphenTitle.ret){
					// TODO: inpliment h2 titel§
				}
			}

			// thematic breaks
			const thematicStar = charRepeatLenght("*", true, pointer + spaces.indexDelta());
			const thematicDash = charRepeatLenght("-", true, pointer + spaces.indexDelta());
			const thematicUnderScore = charRepeatLenght("_", true, pointer + spaces.indexDelta());

			const maxThemticaChars = Math.max(thematicStar.chars, thematicDash.chars, thematicUnderScore.chars);
			const indexDelta = spaces.indexDelta() + Math.max(thematicStar.indexDelta(), thematicDash.indexDelta(), thematicUnderScore. indexDelta());
			if(spaces.totalSpace() <= 3 && 3 <= maxThemticaChars && (docsLength <= pointer + indexDelta || 0 < isNewLineChar(pointer + indexDelta ))){
				//TODO: add thematic breaks to document 
			}

			// Bulletin list
			const bulletListMarker = ["+", "-", "*"].find(x => markdown[pointer + spaces.indexDelta()]);
			if(bulletListMarker !== undefined && spaces.totalSpace() < 4){
				let indentation = spaces.indexDelta() + 1;
				const afterSpaces = charRepeatLenght("", true, indentation);

				if(afterSpaces.indexDelta() !== 0 || isEmptyLine(pointer + indentation)){
					indentation += 1;
					if(afterSpaces.totalSpace() <= 5){
						indentation += afterSpaces.indexDelta() - 1;
					}

					let text = getTextInLine().slice(indentation) + "\n";
					let index = pointer;
					while (true){
						index = nextLine(index);
						if(isEmptyLine(index)){
							text += "\n";
							continue;
						}

						const spaces = charRepeatLenght("", true, index);
						if(spaces.totalSpace() >= indentation){
							text += getTextInLine(index).slice(indentation) + "\n";
							continue;
						}
						break;
					}
					pointer = nextLine(index);
					// TODO: add bullet list in document;
					continue;
				}
			}

			// orded list
			const ordetRegex = new RegExp(/[1-9]{1,9}[\.\)]{1}/);
			const text = getTextInLine();
			const orded = ordetRegex.exec(text);
			if(orded !== null && text.indexOf(orded[0]) === spaces.indexDelta() && spaces.totalSpace() < 4){
				const ordedChar = orded[0][orded[0].length - 1];
				let indentation = spaces.indexDelta() + 1;
				const afterSpaces = charRepeatLenght("", true, indentation);

				if(afterSpaces.indexDelta() !== 0 || isEmptyLine(pointer + indentation)){
					indentation += 1;
					if(afterSpaces.totalSpace() <= 5){
						indentation += afterSpaces.indexDelta() - 1;
					}

					let text = getTextInLine().slice(indentation) + "\n";
					let index = pointer;
					while (true){
						index = nextLine(index);
						if(isEmptyLine(index)){
							text += "\n";
							continue;
						}

						const spaces = charRepeatLenght("", true, index);
						if(spaces.totalSpace() >= indentation){
							text += getTextInLine(index).slice(indentation) + "\n";
							continue;
						}
						break;
					}
					pointer = nextLine(index);
					// TODO: add orded list in document;
					continue;
				}
			}

			// indented codeblock
			if(spaces.totalSpace() > 3 && paragrafText !== "" && true){ // FIXME: not a paragraf in fron and not a list
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
				pointer = nextLine(i);
				// TODO: add indented codeblock to document;
				continue;
			}

			// block quotes
			if(spaces.totalSpace() <= 3 && markdown[pointer + spaces.indexDelta()] === ">"){
				let innerText = "";
				while(true){
					let text = getTextInLine();
					if(spaces.totalSpace() <= 3 && markdown[pointer + spaces.indexDelta()] === ">"){
						let removeChar = spaces.indexDelta() + 1;
						removeChar += (text[removeChar] === " " ? 1 : 0);
						innerText += text.slice(removeChar) + "\r\n";
						continue;
					}
					if(markdownToGoogleDocsReq(text) === null){ // FIXME:  see if the last elemet is normal text (no headding or syntex)

					} 
					break;
				}

				markdownToGoogleDocsReq(innerText);
				// TODO: impliment block quotes
			}
			
			if(spaces.totalSpace() <= 3 ) {
				pointer += spaces.indexDelta();
				
				// fenced codeblock
				const fencedCodeblock = {
					char: "",
					amount: 0,
					spaces: 0
				};
				const repetedBacksticks = charRepeatLenght("`");
				if(3 <= repetedBacksticks.chars){
					fencedCodeblock.char = "`";
					fencedCodeblock.amount = repetedBacksticks.chars;
					fencedCodeblock.spaces = spaces.totalSpace();
				}
				const repetedTildes = charRepeatLenght("~");
				if(3 <= repetedTildes.chars){
					fencedCodeblock.char = "~";
					fencedCodeblock.amount = repetedTildes.chars;
					fencedCodeblock.spaces = spaces.totalSpace();
				}
				if(fencedCodeblock.char !== ""){
					let text = "";
					let i = pointer;
					while (i < docsLength){
						const spaces = charRepeatLenght("", true);
						if(spaces.totalSpace() <= 3){
							const repeatEndChar = charRepeatLenght(fencedCodeblock.char); 
							if(fencedCodeblock.amount <= repeatEndChar.chars && isEmptyLine(i + spaces.indexDelta() + repeatEndChar.chars) !== 0){
								break;
							}
						}

						let skipSpace = spaces.indexDelta() <= fencedCodeblock.spaces ? spaces.indexDelta() : fencedCodeblock.spaces;
						text += getTextInLine(i).slice(skipSpace) + "\n";
						i = nextLine(i);
					}

					text.trimEnd();
					pointer = nextLine(i);

					// TODO: add fenced codeblock to document
					continue;
				}
				
				// ATX Headders
				const titleHashtags = charRepeatLenght("#");
				if(0 < titleHashtags.chars && titleHashtags.chars <= 6){
					const afterSpaces = charRepeatLenght("", true);
					if (0 < spaces.indexDelta() || 0 < isNewLineChar(pointer + titleHashtags.chars + spaces.indexDelta())){
						//det sak var titel
						let text = getTextInLine(pointer).slice(pointer + spaces.indexDelta() + titleHashtags.chars + afterSpaces.indexDelta());
						text = text.trimEnd();

						let i = text.length - 1;

						let hashTagRemove = 0;
						while (0 <= i){
							if(text[i] === "#"){
								hashTagRemove++;
								i--;
								continue;
							}
							break;
						}

						if(0 <= i){
							if(text[i] === " " || text[i] === "\t"){
								text = text.slice(0, text.length - hashTagRemove).trimEnd();
							} else {
								text = text.slice(0, text.length);
							}
						}
						// TODO: add title to document
					}
				}
			}
		}
		
		if(paragrafText !== ""){
			paragrafText += " ";
		}
		paragrafText += getTextInLine().trim();
		pointer = nextLine();

		// var newLines = isNewLineChar();
		// if(0 > newLines){
		// 	//add new line
		// 	pointer += newLines;
		// 	startLine = pointer;
		// }
	}

	req.push({
		insertText: {
			endOfSegmentLocation: {},
			text: markdown
		}
	});
	return req;
}

function inlineText(text: string): docs_v1.Schema$Request[]{
	return [];
}