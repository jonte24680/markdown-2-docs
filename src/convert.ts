import { google, docs_v1, Auth, Common } from "googleapis";

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
	
	function charRepeatLenght(char: string, ignoreSpces: boolean = false, startIndex: number = pointer){
		const ret = { 
			char: 0, 
			spaces: 0, 
			tabs: 0, 
			totalSpace: () => ret.tabs * 4 + ret.spaces, 
			indexDelta: () => ret.char + ret.spaces + ret.tabs
		};
		while(true){
			if(markdown[startIndex + ret.char + ret.spaces + ret.tabs] === char){
				ret.char++;
			} else if (ignoreSpces && markdown[startIndex + ret.char + ret.spaces + ret.tabs] === " "){
				ret.spaces++;
			} else if (ignoreSpces && markdown[startIndex + ret.char + ret.spaces + ret.tabs] === "\t"){
				ret.tabs++;
			} else {
				return ret;
			}
		}
	}

	function nextLinePoint(startIndex: number = pointer){
		const textLenght = markdown.length;
		while(startIndex < textLenght){
			const lines = isNewLineChar(startIndex);
			if(lines !== 0){
				return startIndex + lines;
			}
			pointer++;
		}
		return -1;
	}

	function nextEnterSeperator(startIndex: number = pointer){
		const textLenght = markdown.length;
		while(startIndex < textLenght){
			const lines = isNewLineChar(startIndex);
			if(lines !== 0 && startIndex + lines < textLenght){
				startIndex += lines;
				const repete = charRepeatLenght("", true, startIndex);
				if(startIndex + repete.spaces < textLenght){
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

	

	var req = new Array<docs_v1.Schema$Request>();
	var pointer = 0;
	var startLine = 0;
	var boldStart = -1;
	var italicStart = -1;
	var titleStart = -1;
	var titleType = 0;

	while (pointer < markdown.length){
		const spaces = charRepeatLenght(" ").char;
		if(startLine === pointer && spaces <= 3 ){
			pointer += spaces;

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