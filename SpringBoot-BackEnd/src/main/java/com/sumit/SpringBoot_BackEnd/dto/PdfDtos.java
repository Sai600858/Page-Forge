package com.sumit.SpringBoot_BackEnd.dto;

import java.util.List;

public class PdfDtos {

    public static class OperationDto {
        private String type;
        private List<Integer> pages;
        private Integer page;
        private Integer angle;
        private String position;
        private List<Integer> order;

        public OperationDto() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public List<Integer> getPages() { return pages; }
        public void setPages(List<Integer> pages) { this.pages = pages; }

        public Integer getPage() { return page; }
        public void setPage(Integer page) { this.page = page; }

        public Integer getAngle() { return angle; }
        public void setAngle(Integer angle) { this.angle = angle; }

        public String getPosition() { return position; }
        public void setPosition(String position) { this.position = position; }

        public List<Integer> getOrder() { return order; }
        public void setOrder(List<Integer> order) { this.order = order; }
    }

    public static class ElementDto {
        private String type;
        private Integer page;
        private Float x;
        private Float y;
        private String text;
        private String fontFamily;
        private Float fontSize;
        private String color;
        private String imageBuffer;
        private Float width;
        private Float height;
        private String shapeType;
        private Float thickness;
        private Boolean fill;
        private Float radius;
        private Float x1;
        private Float y1;
        private Float x2;
        private Float y2;

        public ElementDto() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }

        public Integer getPage() { return page; }
        public void setPage(Integer page) { this.page = page; }

        public Float getX() { return x; }
        public void setX(Float x) { this.x = x; }

        public Float getY() { return y; }
        public void setY(Float y) { this.y = y; }

        public String getText() { return text; }
        public void setText(String text) { this.text = text; }

        public String getFontFamily() { return fontFamily; }
        public void setFontFamily(String fontFamily) { this.fontFamily = fontFamily; }

        public Float getFontSize() { return fontSize; }
        public void setFontSize(Float fontSize) { this.fontSize = fontSize; }

        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }

        public String getImageBuffer() { return imageBuffer; }
        public void setImageBuffer(String imageBuffer) { this.imageBuffer = imageBuffer; }

        public Float getWidth() { return width; }
        public void setWidth(Float width) { this.width = width; }

        public Float getHeight() { return height; }
        public void setHeight(Float height) { this.height = height; }

        public String getShapeType() { return shapeType; }
        public void setShapeType(String shapeType) { this.shapeType = shapeType; }

        public Float getThickness() { return thickness; }
        public void setThickness(Float thickness) { this.thickness = thickness; }

        public Boolean getFill() { return fill; }
        public void setFill(Boolean fill) { this.fill = fill; }

        public Float getRadius() { return radius; }
        public void setRadius(Float radius) { this.radius = radius; }

        public Float getX1() { return x1; }
        public void setX1(Float x1) { this.x1 = x1; }

        public Float getY1() { return y1; }
        public void setY1(Float y1) { this.y1 = y1; }

        public Float getX2() { return x2; }
        public void setX2(Float x2) { this.x2 = x2; }

        public Float getY2() { return y2; }
        public void setY2(Float y2) { this.y2 = y2; }
    }
}
